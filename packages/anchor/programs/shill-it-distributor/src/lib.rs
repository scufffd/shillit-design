//! Shill It Fee Distributor – Merkle claim distributor.
//! Funds live in a vault PDA (system account). Operator publishes a Merkle root per epoch.
//! Holders claim permissionlessly by presenting (amount, proof). This avoids the deployer wallet
//! pushing SOL to all holders and helps external UIs integrate via a simple claim transaction.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("2R7aLoBFZDDVLUA3wJPKfkz7KApsox3Tqf8Py7GGeHSL");

const SEED_CONFIG: &[u8] = b"shillit_dist_cfg";
const SEED_VAULT: &[u8] = b"shillit_dist_vault";
const SEED_EPOCH: &[u8] = b"shillit_dist_epoch";
const SEED_CLAIM: &[u8] = b"shillit_dist_claim";

#[program]
pub mod shill_it_distributor {
    use super::*;

    /// Initialize config + vault PDA for a mint (call once).
    pub fn init_mint(ctx: Context<InitMint>, mint: Pubkey, authority: Pubkey) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.mint = mint;
        cfg.authority = authority;
        cfg.bump = ctx.bumps.config;
        cfg.vault_bump = ctx.bumps.vault;
        Ok(())
    }

    /// Create/update a Merkle epoch for this mint.
    pub fn upsert_epoch(
        ctx: Context<UpsertEpoch>,
        epoch_id: u64,
        merkle_root: [u8; 32],
        total_lamports: u64,
    ) -> Result<()> {
        let e = &mut ctx.accounts.epoch;
        e.mint = ctx.accounts.config.mint;
        e.epoch_id = epoch_id;
        e.merkle_root = merkle_root;
        e.total_lamports = total_lamports;
        e.claimed_lamports = 0;
        e.bump = ctx.bumps.epoch;
        Ok(())
    }

    /// Fund the vault PDA (anyone can fund; typically the platform operator after claiming fees).
    pub fn fund_vault(ctx: Context<FundVault>, lamports: u64) -> Result<()> {
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.funder.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            lamports,
        )?;
        Ok(())
    }

    /// Claim SOL for a recipient using a Merkle proof.
    ///
    /// Leaf hash:
    ///   sha256( "shillit:dist:v1" || mint || epoch_id || recipient || amount_lamports )
    ///
    /// Proof is a vector of sibling hashes; order is left/right based on byte comparison.
    pub fn claim(ctx: Context<Claim>, epoch_id: u64, amount_lamports: u64, proof: Vec<[u8; 32]>) -> Result<()> {
        require!(!ctx.accounts.claim_status.claimed, DistError::AlreadyClaimed);
        require!(ctx.accounts.epoch.epoch_id == epoch_id, DistError::BadEpoch);

        let leaf = leaf_hash(
            &ctx.accounts.config.mint,
            epoch_id,
            &ctx.accounts.recipient.key(),
            amount_lamports,
        );
        require!(
            verify_proof(leaf, &proof, ctx.accounts.epoch.merkle_root),
            DistError::InvalidProof
        );

        // Ensure vault has funds.
        let vault_lamports = ctx.accounts.vault.to_account_info().lamports();
        require!(vault_lamports >= amount_lamports, DistError::InsufficientVaultFunds);

        // Transfer SOL from vault PDA to recipient.
        let mint = ctx.accounts.config.mint;
        let signer_seeds: &[&[u8]] = &[
            SEED_VAULT,
            mint.as_ref(),
            &[ctx.accounts.config.vault_bump],
        ];
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.recipient.to_account_info(),
                },
                &[signer_seeds],
            ),
            amount_lamports,
        )?;

        ctx.accounts.claim_status.claimed = true;
        ctx.accounts.claim_status.recipient = ctx.accounts.recipient.key();
        ctx.accounts.claim_status.mint = mint;
        ctx.accounts.claim_status.epoch = ctx.accounts.epoch.key();
        ctx.accounts.claim_status.amount_lamports = amount_lamports;
        ctx.accounts.claim_status.bump = ctx.bumps.claim_status;

        ctx.accounts.epoch.claimed_lamports = ctx
            .accounts
            .epoch
            .claimed_lamports
            .checked_add(amount_lamports)
            .ok_or(DistError::Overflow)?;

        emit!(Claimed {
            mint,
            epoch_id,
            recipient: ctx.accounts.recipient.key(),
            amount_lamports,
        });

        Ok(())
    }

    /// Withdraw remaining SOL from vault (authority only).
    pub fn withdraw_vault(ctx: Context<WithdrawVault>, lamports: u64) -> Result<()> {
        let vault_lamports = ctx.accounts.vault.to_account_info().lamports();
        require!(vault_lamports >= lamports, DistError::InsufficientVaultFunds);

        let mint = ctx.accounts.config.mint;
        let signer_seeds: &[&[u8]] = &[
            SEED_VAULT,
            mint.as_ref(),
            &[ctx.accounts.config.vault_bump],
        ];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.authority.to_account_info(),
                },
                &[signer_seeds],
            ),
            lamports,
        )?;
        Ok(())
    }
}

#[account]
pub struct DistributorConfig {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub bump: u8,
    pub vault_bump: u8,
}

impl DistributorConfig {
    pub const LEN: usize = 32 + 32 + 1 + 1;
}

#[account]
pub struct DistributorEpoch {
    pub mint: Pubkey,
    pub epoch_id: u64,
    pub merkle_root: [u8; 32],
    pub total_lamports: u64,
    pub claimed_lamports: u64,
    pub bump: u8,
}

impl DistributorEpoch {
    pub const LEN: usize = 32 + 8 + 32 + 8 + 8 + 1;
}

#[account]
pub struct ClaimStatus {
    pub mint: Pubkey,
    pub epoch: Pubkey,
    pub recipient: Pubkey,
    pub amount_lamports: u64,
    pub claimed: bool,
    pub bump: u8,
}

impl ClaimStatus {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 1 + 1;
}

/// PDA that holds SOL for a mint. No data; just needs to exist so the program can sign for it.
#[account]
pub struct Vault {}

impl Vault {
    pub const LEN: usize = 0;
}

#[derive(Accounts)]
#[instruction(mint: Pubkey)]
pub struct InitMint<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + DistributorConfig::LEN,
        seeds = [SEED_CONFIG, mint.as_ref()],
        bump
    )]
    pub config: Account<'info, DistributorConfig>,

    /// Vault PDA holding SOL for this mint.
    #[account(
        init,
        payer = payer,
        space = 8 + Vault::LEN,
        seeds = [SEED_VAULT, mint.as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(epoch_id: u64)]
pub struct UpsertEpoch<'info> {
    #[account(
        seeds = [SEED_CONFIG, config.mint.as_ref()],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, DistributorConfig>,

    /// Authority is an operator key (can be multisig).
    pub authority: Signer<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + DistributorEpoch::LEN,
        seeds = [SEED_EPOCH, config.mint.as_ref(), &epoch_id.to_le_bytes()],
        bump
    )]
    pub epoch: Account<'info, DistributorEpoch>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundVault<'info> {
    #[account(
        seeds = [SEED_CONFIG, config.mint.as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, DistributorConfig>,

    /// Vault PDA holding SOL for this mint.
    #[account(
        mut,
        seeds = [SEED_VAULT, config.mint.as_ref()],
        bump = config.vault_bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub funder: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(epoch_id: u64)]
pub struct Claim<'info> {
    #[account(
        seeds = [SEED_CONFIG, config.mint.as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, DistributorConfig>,

    #[account(
        mut,
        seeds = [SEED_EPOCH, config.mint.as_ref(), &epoch_id.to_le_bytes()],
        bump = epoch.bump
    )]
    pub epoch: Account<'info, DistributorEpoch>,

    /// Vault PDA holding SOL for this mint.
    #[account(
        mut,
        seeds = [SEED_VAULT, config.mint.as_ref()],
        bump = config.vault_bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + ClaimStatus::LEN,
        seeds = [SEED_CLAIM, epoch.key().as_ref(), recipient.key().as_ref()],
        bump
    )]
    pub claim_status: Account<'info, ClaimStatus>,

    /// Recipient is the wallet claiming for itself (or a relayer can set payer separately).
    #[account(mut)]
    pub recipient: SystemAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawVault<'info> {
    #[account(
        seeds = [SEED_CONFIG, config.mint.as_ref()],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, DistributorConfig>,

    #[account(
        mut,
        seeds = [SEED_VAULT, config.mint.as_ref()],
        bump = config.vault_bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct Claimed {
    pub mint: Pubkey,
    pub epoch_id: u64,
    pub recipient: Pubkey,
    pub amount_lamports: u64,
}

#[error_code]
pub enum DistError {
    #[msg("Invalid Merkle proof")]
    InvalidProof,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Bad epoch")]
    BadEpoch,
    #[msg("Vault has insufficient SOL")]
    InsufficientVaultFunds,
    #[msg("Overflow")]
    Overflow,
}

fn leaf_hash(mint: &Pubkey, epoch_id: u64, recipient: &Pubkey, amount_lamports: u64) -> [u8; 32] {
    let domain = b"shillit:dist:v1";
    let epoch_bytes = epoch_id.to_le_bytes();
    let amount_bytes = amount_lamports.to_le_bytes();
    hashv(&[
        domain,
        mint.as_ref(),
        epoch_bytes.as_ref(),
        recipient.as_ref(),
        amount_bytes.as_ref(),
    ])
    .to_bytes()
}

fn verify_proof(leaf: [u8; 32], proof: &Vec<[u8; 32]>, root: [u8; 32]) -> bool {
    let mut computed = leaf;
    for p in proof.iter() {
        let (a, b) = if computed <= *p { (computed, *p) } else { (*p, computed) };
        computed = hashv(&[a.as_ref(), b.as_ref()]).to_bytes();
    }
    computed == root
}

