// Byte/document boundary. Providers do not parse bodies, save state or render UI.
export type AcquiredDocument = {
  url: string;
  content: string;
  title?: string;
  format?: "html" | "markdown" | "markdown-tokens";
  fragment?: boolean;
  ruleId?: string;
  ruleVersion?: string;
};
export type DocumentProvider = {
  id: string;
  fetch(): Promise<AcquiredDocument>;
};
