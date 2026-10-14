import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type {
  WithElementRef,
  WithoutChild,
  WithoutChildrenOrChild,
} from "bits-ui";
