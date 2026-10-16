import type { Metadata } from "next";
import { Suspense } from "react";
import { ApiKeyCard } from "@/components/settings/api-key-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { KeyCardsSkeleton } from "@/components/common/skeletons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { getMyKeyUsage, getMySettings } from "@/lib/data/settings";

export const metadata: Metadata = { title: "AI keys" };

export default function ApiKeysPage() {
  return (
    <SettingsSection
      title="AI keys"
      description="Your own keys power the AI features. Save as many as you like and pick the one to use. Keys are encrypted, and only the last 4 characters are ever shown."
    >
      <Suspense fallback={<KeyCardsSkeleton />}>
        <Keys />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
        <Usage />
      </Suspense>
    </SettingsSection>
  );
}

async function Keys() {
  const settings = await getMySettings();
  return (
    <div className="flex flex-col gap-4">
      {AI_PROVIDERS.map((provider) => (
        <ApiKeyCard
          key={provider}
          provider={provider}
          selected={settings.provider === provider}
          keys={settings.keyList.filter((k) => k.provider === provider)}
        />
      ))}
    </div>
  );
}

const number = new Intl.NumberFormat("en-US");

/** Tokens per key and model, so keys and models can be compared. */
async function Usage() {
  const [settings, rows] = await Promise.all([getMySettings(), getMyKeyUsage()]);
  const labels = new Map(settings.keyList.map((k) => [k.id, k.label]));

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Usage, last 30 days</CardTitle>
        <CardDescription>Tokens each key and model used. Fewer tokens per call costs less.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No AI calls yet. Usage shows here after you use an AI feature.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Tokens in</TableHead>
                <TableHead className="text-right">Tokens out</TableHead>
                <TableHead className="text-right">Per call</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={`${r.keyId}-${r.model}`}>
                  <TableCell>{(r.keyId && labels.get(r.keyId)) ?? <span className="text-muted-foreground">Removed key</span>}</TableCell>
                  <TableCell className="font-mono text-xs">{r.model}</TableCell>
                  <TableCell className="text-right tabular-nums">{number.format(r.calls)}</TableCell>
                  <TableCell className="text-right tabular-nums">{number.format(r.inputTokens)}</TableCell>
                  <TableCell className="text-right tabular-nums">{number.format(r.outputTokens)}</TableCell>
                  <TableCell className="text-right tabular-nums">{number.format(Math.round((r.inputTokens + r.outputTokens) / r.calls))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
