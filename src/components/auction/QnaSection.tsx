"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MessageCircle, Send, ShieldCheck, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { askQuestion, answerQuestion, type PublicQuestion } from "@/actions/qa";

interface QnaSectionProps {
  auctionId: string;
  sellerId: string;
  /** Server-fetched questions, hydrated on initial render. */
  initialQuestions: PublicQuestion[];
  /** Whether the auction is still ACTIVE — closed auctions don't accept new Qs. */
  isActive: boolean;
}

const QUESTION_MAX = 500;
const ANSWER_MAX = 2000;

export function QnaSection({ auctionId, sellerId, initialQuestions, isActive }: QnaSectionProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations("Qna");
  const [questions, setQuestions] = useState<PublicQuestion[]>(initialQuestions);
  const [draft, setDraft] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [pendingAnswerId, setPendingAnswerId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const viewerId = session?.user?.id ?? null;
  const isSeller = !!viewerId && viewerId === sellerId;
  const canAsk = isActive && !!viewerId && !isSeller;

  const handleAsk = () => {
    const trimmed = draft.trim();
    if (trimmed.length < 5) {
      toast.error(t("askMin"));
      return;
    }
    if (trimmed.length > QUESTION_MAX) {
      toast.error(t("askMax", { max: QUESTION_MAX }));
      return;
    }

    startTransition(async () => {
      const res = await askQuestion({ auctionId, question: trimmed });
      if (res.success && res.data) {
        toast.success(t("askPosted"));
        setDraft("");
        // Optimistically prepend so the user sees their question immediately.
        const newQ: PublicQuestion = {
          id:          res.data.questionId,
          auctionId,
          askerId:     viewerId!,
          askerName:   session?.user?.name ?? null,
          question:    trimmed,
          answer:      null,
          answeredAt:  null,
          createdAt:   new Date(),
        };
        setQuestions((prev) => [newQ, ...prev]);
        router.refresh();
      } else {
        toast.error(res.error?.message ?? t("askFailed"));
      }
    });
  };

  const handleAnswer = (questionId: string) => {
    const trimmed = (answerDrafts[questionId] ?? "").trim();
    if (trimmed.length < 1) {
      toast.error(t("answerMin"));
      return;
    }
    if (trimmed.length > ANSWER_MAX) {
      toast.error(t("answerMax", { max: ANSWER_MAX }));
      return;
    }

    setPendingAnswerId(questionId);
    startTransition(async () => {
      const res = await answerQuestion({ questionId, answer: trimmed });
      setPendingAnswerId(null);
      if (res.success) {
        toast.success(t("answerPosted"));
        setQuestions((prev) =>
          prev.map((q) => (q.id === questionId ? { ...q, answer: trimmed, answeredAt: new Date() } : q)),
        );
        setAnswerDrafts((prev) => {
          const next = { ...prev };
          delete next[questionId];
          return next;
        });
        router.refresh();
      } else {
        toast.error(res.error?.message ?? t("answerFailed"));
      }
    });
  };

  return (
    <section className="bg-white border border-gray-100 rounded-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary-600" />
          <h2 className="font-heading font-semibold text-gray-900 text-lg">
            {t("title")}
          </h2>
        </div>
        <span className="text-[10px] font-mono text-gray-400 bg-gray-50 border border-gray-100 px-2 py-1 rounded">
          {questions.length}
        </span>
      </div>

      {/* Compose */}
      {canAsk ? (
        <div className="mb-6 bg-gray-50/60 border border-gray-100 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("ask")}
              maxLength={QUESTION_MAX}
              rows={2}
              disabled={isPending}
              className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-gray-400 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleAsk}
              disabled={isPending || draft.trim().length < 5}
              aria-label="Post question"
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1">
            <p className="text-[10px] text-gray-400">{t("askHint")}</p>
            <span className={`text-[10px] font-mono ${draft.length >= QUESTION_MAX ? "text-red-600" : "text-gray-400"}`}>
              {draft.length} / {QUESTION_MAX}
            </span>
          </div>
        </div>
      ) : !isActive ? (
        <p className="mb-6 text-xs text-gray-500 italic px-1">{t("auctionEnded")}</p>
      ) : !viewerId ? (
        <p className="mb-6 text-xs text-gray-500 px-1">
          <a href="/login" className="text-primary-600 hover:underline font-medium">{t("signInPrompt")}</a> {t("signInToAsk")}
        </p>
      ) : (
        <p className="mb-6 text-xs text-gray-500 italic px-1">{t("ownListingHint")}</p>
      )}

      {/* List */}
      {questions.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl py-10 text-center">
          <MessageCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{t("noQuestions")}</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {questions.map((q) => {
            const showAnswerBox = isSeller && !q.answer;
            const isAnswering = pendingAnswerId === q.id && isPending;
            const draftAnswer = answerDrafts[q.id] ?? "";
            return (
              <li key={q.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                    {(q.askerName ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-900">{q.askerName ?? t("buyerFallback")}</span>
                      <span className="text-[10px] text-gray-400">{relativeTime(q.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{q.question}</p>
                  </div>
                </div>

                {q.answer ? (
                  <div className="mt-3 ml-11 pl-3 border-l-2 border-emerald-200">
                    <div className="flex items-baseline gap-2 mb-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 self-center" />
                      <span className="text-xs font-bold text-emerald-700">{t("sellerLabel")}</span>
                      <span className="text-[10px] text-gray-400">{q.answeredAt ? relativeTime(q.answeredAt) : ""}</span>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{q.answer}</p>
                  </div>
                ) : showAnswerBox ? (
                  <div className="mt-3 ml-11 bg-emerald-50/40 border border-emerald-100 rounded-lg p-3">
                    <textarea
                      value={draftAnswer}
                      onChange={(e) => setAnswerDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder={t("answerPlaceholder")}
                      maxLength={ANSWER_MAX}
                      rows={2}
                      disabled={isAnswering}
                      className="w-full bg-transparent text-sm resize-none outline-none placeholder:text-gray-400 disabled:opacity-50"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-[10px] font-mono ${draftAnswer.length >= ANSWER_MAX ? "text-red-600" : "text-gray-400"}`}>
                        {draftAnswer.length} / {ANSWER_MAX}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAnswer(q.id)}
                        disabled={isAnswering || draftAnswer.trim().length < 1}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors disabled:opacity-40"
                      >
                        {isAnswering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        {t("postAnswer")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 ml-11 text-[11px] text-gray-400 italic">{t("awaitingAnswer")}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function relativeTime(d: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 60)        return "just now";
  if (seconds < 3600)      return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400)     return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)}d ago`;
  return d.toLocaleDateString();
}
