declare module "isomorphic-dompurify" {
  import type createDOMPurify from "dompurify";
  import type { DOMPurifyI } from "dompurify";

  const DOMPurify: DOMPurifyI;
  export default DOMPurify;

  export type CreateDOMPurify = typeof createDOMPurify;
  export * from "dompurify";
}
