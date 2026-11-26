import { ArrowUpRight, Clock3, KeyRound, UserRound } from "lucide-react";
import { ShareCard, ShareStack } from "@/components/share-stack";
import { ButtonLink, Logo, Pill } from "@/components/ui";

export default function Welcome() {
  return (
    // One screen, no scroll.
    <main className="flex h-dvh min-h-[600px] flex-col px-5 pt-[calc(env(safe-area-inset-top)+14px)] pb-[calc(env(safe-area-inset-bottom)+18px)]">
      <header className="flex h-12 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[21px] font-extrabold tracking-[-0.02em]">ZecHeir</span>
        </div>
        <Pill>Testnet</Pill>
      </header>

      <h1 className="zh-in mt-6 text-[38px] leading-[1.02] font-extrabold tracking-[-0.035em] [@media(max-height:700px)]:text-[32px]">
        Your ZEC reaches
        <br />
        your family.
        <br />
        <span className="text-primary">Even if you can&apos;t.</span>
      </h1>

      <div className="flex min-h-0 flex-1 flex-col justify-center py-5">
        <ShareStack className="zh-in" >
          <ShareCard first tone="yellow" kicker="Share 1" title="You" right={<KeyRound size={22} strokeWidth={2.4} aria-hidden />} />
          <ShareCard tone="indigo" kicker="Share 2" title="Your guardian" right={<UserRound size={22} strokeWidth={2.4} aria-hidden />} />
          <ShareCard tone="paper" kicker="Share 3" title="Check-in switch" right={<Clock3 size={22} strokeWidth={2.4} aria-hidden />}>
            <p className="mt-3 text-[14.5px] leading-snug font-medium opacity-70 [@media(max-height:700px)]:hidden">
              Any two can sign. Stop checking in and your guardian releases the vault, privately, to your heir.
            </p>
          </ShareCard>
        </ShareStack>
      </div>

      <div className="flex flex-col gap-2.5">
        <ButtonLink href="/setup">Create my vault</ButtonLink>
        <ButtonLink href="/vault/demo" variant="dark">
          Open the live demo <ArrowUpRight size={18} strokeWidth={2.4} aria-hidden />
        </ButtonLink>
      </div>
    </main>
  );
}
