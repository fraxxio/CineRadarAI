import ChatAssistant from "@/Components/ChatAssistant";
import RecaptchaWrapper from "@/infra/recaptcha/RecaptchaWrapper";
import { DeleteResult } from "@/modules/account";
import { isRecaptchaEnabled } from "@/infra/recaptcha/recaptcha";

export const runtime = "edge";

const greeting =
  "Ask me for movie or TV show recommendations! Describe what you would like to watch: genre, actors, style, mood and other movie related criteria.";

export default function Home({
  searchParams,
}: {
  searchParams: { deleteAcc: string };
}) {
  const aiChatEnabled = process.env.AI_CHAT_ENABLED === "true";
  const recaptchaEnabled = isRecaptchaEnabled();

  return (
    <main className="container py-10">
      <DeleteResult deleteAcc={searchParams.deleteAcc} />
      {aiChatEnabled ? (
        recaptchaEnabled ? (
          <RecaptchaWrapper>
            <ChatAssistant greeting={greeting} recaptchaEnabled />
          </RecaptchaWrapper>
        ) : (
          <ChatAssistant greeting={greeting} recaptchaEnabled={false} />
        )
      ) : (
        <div className="relative overflow-hidden">
          {/* React 18 drops a boolean `inert`; the string "" renders it */}
          <div inert={"" as unknown as boolean} className="pointer-events-none">
            <ChatAssistant
              greeting={greeting}
              recaptchaEnabled={recaptchaEnabled}
            />
          </div>
          <div className="absolute inset-0 z-10 rounded-sm bg-black/70" />
          <div className="absolute left-1/2 top-1/2 z-20 w-[150%] -translate-x-1/2 -translate-y-1/2 -rotate-[8deg] select-none whitespace-nowrap bg-yellow-400 py-3 text-center text-xl font-extrabold tracking-widest text-black">
            OUT OF ORDER · OUT OF ORDER · OUT OF ORDER · OUT OF ORDER · OUT OF
            ORDER
          </div>
          <div className="absolute left-1/2 top-40 z-30 w-[90%] max-w-md -translate-x-1/2 rounded-md border border-border-clr bg-primary-bg p-4 text-center shadow-lg">
            Unfortunately, the AI chat feature is no longer available due to
            token costs.
          </div>
        </div>
      )}
    </main>
  );
}
