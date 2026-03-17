//! Shill It Registry – on-chain image uniqueness.
//! One token per unique image: register image hash PDA; reject duplicates.

use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod shill_it_registry {
    use super::*;

    /// Registers an image hash. Call only after mint; ensures one token per image.
    /// Seeds: ["shillit_image", hash_bytes]
    pub fn register_image(ctx: Context<RegisterImage>, image_hash: [u8; 32]) -> Result<()> {
        let reg = &mut ctx.accounts.registry;
        reg.image_hash = image_hash;
        reg.mint = ctx.accounts.mint.key();
        reg.authority = ctx.accounts.authority.key();
        reg.bump = ctx.bumps.registry;
        reg.created_at = Clock::get()?.unix_timestamp;
        Ok(())
    }
}

#[account]
pub struct ImageRegistry {
    pub image_hash: [u8; 32],
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub bump: u8,
    pub created_at: i64,
}

impl ImageRegistry {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 1 + 8;
}

#[derive(Accounts)]
#[instruction(image_hash: [u8; 32])]
pub struct RegisterImage<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ImageRegistry::LEN,
        seeds = [b"shillit_image", image_hash.as_slice()],
        bump
    )]
    pub registry: Account<'info, ImageRegistry>,

    /// Mint of the token that uses this image (Token-2022).
    /// CHECK: validated by creator; must match the token just created
    pub mint: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}
