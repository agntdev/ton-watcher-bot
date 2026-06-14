import { type ConversationFlavor } from "@grammyjs/conversations";
import { type Context, type SessionFlavor } from "grammy";
import { type CoinSymbol } from "./types";

export interface SessionData {
  step?: string;
  coin?: CoinSymbol;
  thresholdType?: string;
  thresholdValue?: number;
  startTime?: string;
  endTime?: string;
  pendingConfirm?: boolean;
}

export type MyContext = Context & SessionFlavor<SessionData> & ConversationFlavor;
