import type { ReactNode } from "react";
import { Body, Container, Head, Hr, Html, Img, Preview, Section, Text } from "react-email";
import { BRAND_PRIMARY_HEX, ICON_192_PATH, SITE_NAME, SITE_TAGLINE } from "@/lib/constants/site";

/**
 * Shared shell for every email: logo, card, footer. Styles are inline because
 * many email clients strip <style> tags and ignore CSS variables.
 */
export function EmailLayout({
  preview,
  appUrl,
  children,
}: {
  preview: string;
  appUrl: string;
  children: ReactNode;
}) {
  // Email clients cannot load images from localhost, so only show the logo
  // when the app runs on a public https URL.
  const showLogo = appUrl.startsWith("https://");

  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            {showLogo ? (
              <Img src={`${appUrl}${ICON_192_PATH}`} width="40" height="40" alt={SITE_NAME} style={styles.logo} />
            ) : null}
            <Text style={styles.brand}>{SITE_NAME}</Text>
          </Section>
          <Section style={styles.card}>{children}</Section>
          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            {SITE_NAME}. {SITE_TAGLINE}
            <br />
            You received this email because of an action on your account.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  heading: { fontSize: "22px", fontWeight: 600, color: "#0a0a0a", margin: "0 0 12px" },
  text: { fontSize: "15px", lineHeight: "24px", color: "#404040", margin: "0 0 16px" },
  button: {
    display: "inline-block",
    backgroundColor: BRAND_PRIMARY_HEX,
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 600,
    textDecoration: "none",
    borderRadius: "8px",
    padding: "12px 24px",
  },
  muted: { fontSize: "13px", lineHeight: "20px", color: "#737373", margin: "16px 0 0" },
  link: { color: BRAND_PRIMARY_HEX, wordBreak: "break-all" as const },
};

const styles = {
  body: {
    backgroundColor: "#f5f5f5",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    margin: 0,
    padding: "32px 0",
  },
  container: { maxWidth: "480px", margin: "0 auto", padding: "0 16px" },
  header: { textAlign: "center" as const, marginBottom: "16px" },
  logo: { margin: "0 auto 8px", borderRadius: "10px" },
  brand: { fontSize: "16px", fontWeight: 600, color: "#0a0a0a", margin: 0 },
  card: { backgroundColor: "#ffffff", borderRadius: "12px", padding: "32px", border: "1px solid #e5e5e5" },
  hr: { borderColor: "#e5e5e5", margin: "24px 0 16px" },
  footer: { fontSize: "12px", lineHeight: "18px", color: "#a3a3a3", textAlign: "center" as const, margin: 0 },
};
