import { Button, Heading, Link, Text } from "react-email";
import { SITE_NAME } from "@/lib/constants/site";
import { EmailLayout, emailStyles } from "./components/email-layout";

export function VerifyEmail({ name, url, appUrl }: { name: string; url: string; appUrl: string }) {
  return (
    <EmailLayout preview={`Confirm your email for ${SITE_NAME}`} appUrl={appUrl}>
      <Heading style={emailStyles.heading}>Confirm your email</Heading>
      <Text style={emailStyles.text}>Hi {name},</Text>
      <Text style={emailStyles.text}>
        Thanks for signing up for {SITE_NAME}. Tap the button below to confirm your email address and start using
        your assistant.
      </Text>
      <Button href={url} style={emailStyles.button}>
        Confirm email
      </Button>
      <Text style={emailStyles.muted}>
        If the button does not work, copy this link into your browser:
        <br />
        <Link href={url} style={emailStyles.link}>
          {url}
        </Link>
      </Text>
      <Text style={emailStyles.muted}>If you did not create an account, you can ignore this email.</Text>
    </EmailLayout>
  );
}

// Sample props for the `pnpm email:dev` preview.
VerifyEmail.PreviewProps = {
  name: "Ravi",
  url: "http://localhost:3000/api/auth/verify-email?token=example",
  appUrl: "http://localhost:3000",
};

export default VerifyEmail;
