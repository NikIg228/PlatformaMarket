import { notFound } from "next/navigation";
import { ComponentSamples } from "./samples";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ComponentSamples />;
}
