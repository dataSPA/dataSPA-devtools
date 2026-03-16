import {
  DATASPA_DEVTOOLS,
  PAGE_BRIDGE_VERSION,
  DATASTAR_FETCH_EVENT,
  DATASTAR_SIGNAL_PATCH_EVENT,
  GET_SIGNAL_ROOT_REPLY,
} from "~/utils/constants";
import type { BridgeEventMessage } from "~/utils/types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function isBridgeEventMessage(
  msg: unknown,
): msg is BridgeEventMessage {
  if (!isRecord(msg)) return false;
  if (msg.source !== DATASPA_DEVTOOLS) return false;
  if (msg.version !== PAGE_BRIDGE_VERSION) return false;
  if (
    msg.type !== DATASTAR_FETCH_EVENT &&
    msg.type !== DATASTAR_SIGNAL_PATCH_EVENT &&
    msg.type !== GET_SIGNAL_ROOT_REPLY
  ) {
    return false;
  }
  if (!isRecord(msg.payload)) return false;
  return typeof msg.payload.data === "string";
}
