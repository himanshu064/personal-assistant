"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2Icon, CheckIcon, CopyIcon, ExternalLinkIcon, PlugZapIcon } from "lucide-react";
import { InfoTip } from "@/components/common/info-tip";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { deleteGoogleClient, saveGoogleClient, testSavedGoogleClient } from "@/app/(app)/settings/actions";
import { googleClientSchema, type GoogleClientValues } from "@/lib/validation/settings";
import { safeAction } from "@/lib/safe-action";

const CONSOLE_URL = "https://console.cloud.google.com/apis/credentials";

/**
 * The user's own Google app (OAuth client) for connecting Gmail: how to make
 * one, the redirect URL to register, and the Client ID and secret, checked
 * with Google when saved.
 */
export function GoogleClientCard({
  redirectUri,
  saved,
}: {
  redirectUri: string;
  saved: { clientId: string; secretLast4: string } | null;
}) {
  const [editing, setEditing] = useState(!saved);
  const [busy, setBusy] = useState<"test" | "remove" | null>(null);
  const [copied, setCopied] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GoogleClientValues>({
    resolver: zodResolver(googleClientSchema),
    defaultValues: { clientId: saved?.clientId ?? "", clientSecret: "" },
  });

  async function onSubmit(values: GoogleClientValues) {
    const result = await safeAction(() => saveGoogleClient(values));
    if (!result.ok) return setError(result.field === "clientSecret" ? "clientSecret" : "clientId", { message: result.error });
    reset({ clientId: values.clientId, clientSecret: "" });
    setEditing(false);
    toast.add({ title: result.message, type: "success" });
  }

  async function run(kind: "test" | "remove") {
    setBusy(kind);
    const result = await safeAction(() => (kind === "test" ? testSavedGoogleClient() : deleteGoogleClient()));
    setBusy(null);
    if (result.ok && kind === "remove") {
      reset({ clientId: "", clientSecret: "" });
      setEditing(true);
    }
    toast.add({ title: result.ok ? result.message : result.error, type: result.ok ? "success" : "error" });
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          Your Google app
          <InfoTip label="How to set up your Google app" title="Set up your Google app (about 5 minutes)">
            <ol className="flex list-decimal flex-col gap-1.5 pl-4">
              <li>
                Open{" "}
                <a href={CONSOLE_URL} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-2">
                  Google Cloud Console
                </a>{" "}
                and create a project (or pick one).
              </li>
              <li>
                <b className="text-foreground">APIs &amp; Services &gt; Library</b>: search <b className="text-foreground">Gmail API</b> and click Enable.
              </li>
              <li>
                <b className="text-foreground">Google Auth Platform</b> (OAuth consent screen): Get started, enter an app name and your email,
                choose <b className="text-foreground">External</b>.
              </li>
              <li>
                <b className="text-foreground">Audience &gt; Test users</b>: add every Gmail address you will connect.
              </li>
              <li>
                <b className="text-foreground">Data access</b>: add the scope <code className="text-foreground">gmail.readonly</code>.
              </li>
              <li>
                <b className="text-foreground">Clients &gt; Create client</b>: type <b className="text-foreground">Web application</b>. Under
                Authorized redirect URIs, add the Redirect URL shown below.
              </li>
              <li>Copy the Client ID and Client secret into the fields below, then Save and test.</li>
            </ol>
            <p>While the app is in Testing mode, Google asks you to reconnect Gmail every 7 days.</p>
          </InfoTip>
        </CardTitle>
        <CardDescription>
          {saved && !editing ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2Icon className="size-4 text-emerald-600" aria-hidden />
              Saved. Secret ends in <span className="font-mono">{saved.secretLast4}</span>
            </span>
          ) : (
            "Gmail connects through a Google app you own. The secret is encrypted."
          )}
        </CardDescription>
        {saved && !editing ? (
          <CardAction className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => run("test")} disabled={busy !== null}>
              {busy === "test" ? <Spinner /> : <PlugZapIcon />}
              Test connection
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={busy !== null}>
              Replace
            </Button>
            <Button variant="ghost" size="sm" onClick={() => run("remove")} disabled={busy !== null}>
              {busy === "remove" ? <Spinner /> : null}
              Remove
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="google-redirect-uri" className="gap-1.5">
            Redirect URL
            <InfoTip label="About the Redirect URL" title="Redirect URL">
              <p>
                Paste this exactly into <b className="text-foreground">Authorized redirect URIs</b> on your Web client in Google Cloud. Google only
                sends you back to addresses listed there.
              </p>
              <p>If you also open the app at another address (for example a preview link), add that address&apos;s URL too.</p>
            </InfoTip>
          </FieldLabel>
          <div className="flex gap-2">
            <Input id="google-redirect-uri" readOnly value={redirectUri} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label={copied ? "Copied" : "Copy Redirect URL"}
              onClick={() =>
                void navigator.clipboard.writeText(redirectUri).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
              }
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </Button>
          </div>
        </Field>

        {saved && !editing ? (
          <p className="truncate text-sm text-muted-foreground">
            Client ID: <span className="font-mono text-foreground">{saved.clientId}</span>
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
            <Field data-invalid={errors.clientId ? true : undefined}>
              <FieldLabel htmlFor="google-client-id" className="gap-1.5">
                Client ID
                <InfoTip label="Where to find the Client ID" title="Client ID">
                  <p>
                    Looks like <code className="text-foreground">1234567890-abc123.apps.googleusercontent.com</code>.
                  </p>
                  <p>
                    In Google Cloud: <b className="text-foreground">Google Auth Platform &gt; Clients</b>, open your Web client and copy the Client ID.
                  </p>
                </InfoTip>
              </FieldLabel>
              <Input
                id="google-client-id"
                autoComplete="off"
                spellCheck={false}
                placeholder="1234567890-abc.apps.googleusercontent.com"
                aria-invalid={errors.clientId ? true : undefined}
                {...register("clientId")}
              />
              {errors.clientId ? <FieldError>{errors.clientId.message}</FieldError> : null}
            </Field>
            <Field data-invalid={errors.clientSecret ? true : undefined}>
              <FieldLabel htmlFor="google-client-secret" className="gap-1.5">
                Client secret
                <InfoTip label="Where to find the Client secret" title="Client secret">
                  <p>
                    Usually starts with <code className="text-foreground">GOCSPX-</code>. It is shown when you create the client; on the client&apos;s
                    page you can also add a new secret.
                  </p>
                  <p>It is stored encrypted, and only its last 4 characters are ever shown.</p>
                </InfoTip>
              </FieldLabel>
              <Input
                id="google-client-secret"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="GOCSPX-..."
                aria-invalid={errors.clientSecret ? true : undefined}
                {...register("clientSecret")}
              />
              {errors.clientSecret ? <FieldError>{errors.clientSecret.message}</FieldError> : null}
            </Field>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="submit" size="page" disabled={isSubmitting}>
                {isSubmitting ? <Spinner /> : null}
                {isSubmitting ? "Checking with Google" : "Save and test"}
              </Button>
              {saved ? (
                <Button type="button" variant="ghost" size="page" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              ) : null}
              <a
                href={CONSOLE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:ml-auto"
              >
                Open Google Cloud
                <ExternalLinkIcon className="size-3.5" aria-hidden />
              </a>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
