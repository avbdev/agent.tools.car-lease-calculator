/**
 * /quote/[id] — Shareable quote page.
 * Fetches the quote server-side and renders the calculator
 * pre-populated with saved inputs.
 */

import { Metadata } from "next";
import { getQuote } from "@/lib/quotes";
import { LeaseCalculator } from "@/components/calculator/LeaseCalculator";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const quote = await getQuote(id).catch(() => null);

  if (!quote) {
    return { title: "Quote Not Found — Car Lease Calculator" };
  }

  return {
    title: `${quote.label} — Car Lease Calculator`,
    description: `Shared lease quote saved on ${new Date(quote.createdAt).toLocaleDateString()}. Expires ${new Date(quote.expiresAt).toLocaleDateString()}.`,
  };
}

export default async function QuotePage({ params }: Props) {
  const { id } = await params;
  const quote = await getQuote(id).catch(() => null);

  if (!quote) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Quote Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            This quote either doesn&apos;t exist or has expired (quotes are
            valid for 90 days).
          </p>
          <a
            href="/"
            className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start a New Calculation
          </a>
        </div>
      </main>
    );
  }

  return (
    <LeaseCalculator
      initialInputs={quote.inputs}
      quoteMeta={{ id: quote.id, label: quote.label, createdAt: quote.createdAt, expiresAt: quote.expiresAt }}
    />
  );
}
