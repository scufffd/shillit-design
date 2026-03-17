import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ShillItRegistry } from "../target/types/shill_it_registry";
import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";

describe("shill_it_registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ShillItRegistry as Program<ShillItRegistry>;
  const authority = provider.wallet;
  const mint = Keypair.generate();
  const imageHash = Buffer.alloc(32, 1);

  it("registers image", async () => {
    const [registryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("shillit_image"), imageHash],
      program.programId
    );

    await program.methods
      .registerImage(Array.from(imageHash))
      .accounts({
        registry: registryPda,
        mint: mint.publicKey,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const reg = await program.account.imageRegistry.fetch(registryPda);
    expect(reg.mint.equals(mint.publicKey)).to.be.true;
    expect(reg.authority.equals(authority.publicKey)).to.be.true;
    expect(Buffer.from(reg.imageHash).equals(imageHash)).to.be.true;
  });
});
