import type { FAQ } from "@/types";
import data from "../../content/faq.json";

export const faqs: FAQ[] = (data as { faqs: FAQ[] }).faqs || [];
