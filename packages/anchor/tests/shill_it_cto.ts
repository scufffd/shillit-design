import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ShillItCto } from "../target/types/shill_it_cto";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { expect } from "chai";

describe("shill_it_cto", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ShillItCto as Program<ShillItCto>;
  const authority = provider.wallet;
  const minCtoFee = 50 * LAMPORTS_PER_SOL;

  let treasuryPda: PublicKey;
  let mint: PublicKey;
  let newAuthority: PublicKey;

  before("init treasury", async () => {
    [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("shillit_treasury")],
      program.programId
    );

    await program.methods
      .initTreasury(new anchor.BN(minCtoFee))
      .accounts({
        treasury: treasuryPda,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const t = await program.account.treasuryVault.fetch(treasuryPda);
    expect(t.authority.equals(authority.publicKey)).to.be.true;
    expect(t.minCtoFeeLamports.toNumber()).to.eq(minCtoFee);
  });

  it("cto claim pays fee to treasury", async () => {
    mint = Keypair.generate().publicKey;
    newAuthority = Keypair.generate().publicKey;
    const feeLamports = 100 * LAMPORTS_PER_SOL;

    await program.methods
      .ctoClaim(mint, new anchor.BN(feeLamports))
      .accounts({
        treasury: treasuryPda,
        mint,
        newAuthority,
        payer: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const t = await program.account.treasuryVault.fetch(treasuryPda);
    expect(t.totalFeesCollected.toNumber()).to.eq(feeLamports);
  });
});
