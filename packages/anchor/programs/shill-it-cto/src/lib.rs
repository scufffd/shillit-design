//! Shill It CTO (Community Takeover) + Treasury Vault.
//! Inactive/low-cap tokens: new team pays fee to treasury, gains metadata/update authority.
//! Treasury holds SOL; multisig (Squads) controls withdrawals.

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Ce6TQqeWD9gTmq5Mn2VT5t6oU7L5L3NnQ7j2vH8kP4mR");

#[program]
pub mod shill_it_cto {
    use super::*;

    /// Initialize the global treasury vault (PDA). Call once; authority = Squads multisig.
    pub fn init_treasury(ctx: Context<InitTreasury>, min_cto_fee_lamports: u64) -> Result<()> {
        let t = &mut ctx.accounts.treasury;
        t.authority = ctx.accounts.authority.key();
        t.bump = ctx.bumps.treasury;
        t.min_cto_fee_lamports = min_cto_fee_lamports;
        t.total_fees_collected = 0;
        Ok(())
    }

    /// CTO claim: new team pays fee (SOL) to treasury; receives update authority for the mint's metadata.
    /// Inactivity / low MC must be verified off-chain; this instruction trusts the backend/oracle or a separate guard.
    pub fn cto_claim(
        ctx: Context<CtoClaim>,
        _mint: Pubkey,
        fee_lamports: u64,
    ) -> Result<()> {
        require!(fee_lamports >= ctx.accounts.treasury.min_cto_fee_lamports, CtoError::FeeTooLow);

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            fee_lamports,
        )?;

        let t = &mut ctx.accounts.treasury;
        t.total_fees_collected = t.total_fees_collected.checked_add(fee_lamports).ok_or(CtoError::Overflow)?;

        // TODO: CPI to Metaplex Token Metadata to transfer update authority to ctx.accounts.new_authority.
        // For scaffold we only record the claim; production must invoke Metaplex.
        emit!(CtoClaimed {
            mint: ctx.accounts.mint.key(),
            new_authority: ctx.accounts.new_authority.key(),
            fee_lamports,
        });

        Ok(())
    }

    /// Set minimum CTO fee (only treasury authority).
    pub fn set_min_cto_fee(ctx: Context<SetMinCtoFee>, lamports: u64) -> Result<()> {
        ctx.accounts.treasury.min_cto_fee_lamports = lamports;
        Ok(())
    }
}

#[account]
pub struct TreasuryVault {
    pub authority: Pubkey,
    pub bump: u8,
    pub min_cto_fee_lamports: u64,
    pub total_fees_collected: u64,
}

impl TreasuryVault {
    pub const LEN: usize = 8 + 32 + 1 + 8 + 8;
}

#[derive(Accounts)]
pub struct InitTreasury<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + TreasuryVault::LEN,
        seeds = [b"shillit_treasury"],
        bump
    )]
    pub treasury: Account<'info, TreasuryVault>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_mint: Pubkey)]
pub struct CtoClaim<'info> {
    #[account(
        mut,
        seeds = [b"shillit_treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, TreasuryVault>,

    /// Mint whose metadata will be taken over. CHECK: validated off-chain.
    pub mint: UncheckedAccount<'info>,

    /// New team / CTO claimant (will receive update authority via Metaplex CPI in production).
    /// CHECK: recipient of authority transfer
    pub new_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetMinCtoFee<'info> {
    #[account(
        mut,
        seeds = [b"shillit_treasury"],
        bump = treasury.bump,
        has_one = authority
    )]
    pub treasury: Account<'info, TreasuryVault>,

    pub authority: Signer<'info>,
}

#[error_code]
pub enum CtoError {
    #[msg("CTO fee below minimum")]
    FeeTooLow,
    #[msg("Overflow")]
    Overflow,
}

#[event]
pub struct CtoClaimed {
    pub mint: Pubkey,
    pub new_authority: Pubkey,
    pub fee_lamports: u64,
}
