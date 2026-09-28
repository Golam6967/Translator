declare module "cors" {
  import { RequestHandler } from "express";
  export default function cors(options?: Record<string, unknown>): RequestHandler;
}
