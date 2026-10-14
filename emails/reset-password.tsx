import { Button, Heading, Link, Text } from "react-email";
import { SITE_NAME } from "@/lib/constants/site";
import { EmailLayout, emailStyles } from "./components/email-layout";

export function ResetPasswordEmail({ name, url, appUrl }: { name: string; url: string; appUrl: string }) {
  return (
    <EmailLayout preview={`Reset your ${SITE_NAME} password`} appUrl={appUrl}>
      <Heading style={emailStyles.heading}>Reset your password</Heading>
      <Text style={emailStyles.text}>Hi {name},</Text>
      <Text style={emailStyles.text}>
        We received a request to reset your password. Tap the button below to choose a new one. The link expires in
        1 hour.
      </Text>
      <Button href={url} style={emailStyles.button}>
        Reset password
      </Button>
      <Text style={emailStyles.muted}>
        If the button does not work, copy this link into your browser:
        <br />
        <Link href={url} style={emailStyles.link}>
          {url}
        </Link>
      </Text>
      <Text style={emailStyles.muted}>
        If you did not ask for this, you can ignore this email. Your password stays the same.
      </Text>
    </EmailLayout>
  );
}

// Sample props for the `pnpm email:dev` preview.
ResetPasswordEmail.PreviewProps = {
  name: "Ravi",
  url: "http://localhost:3000/reset-password?token=example",
  appUrl: "http://localhost:3000",
};

export default ResetPasswordEmail;
