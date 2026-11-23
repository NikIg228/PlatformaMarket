import { beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";
const state = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, request: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => { const i=state.cursor++; if (!(i in state.slots)) state.slots[i]=initial; return [state.slots[i], (v: unknown) => { state.slots[i]=v; }]; },
  useRef: (initial: unknown) => { const i=state.cursor++; if (!(i in state.slots)) state.slots[i]={current:initial}; return state.slots[i]; },
}));
vi.mock("@marketplace/ui", () => ({ DmButton:"button", DmField:"field", DmInput:"input", LoadingState:"loading" }));
vi.mock("../auth-components", () => ({ AuthBrand:"brand", AuthNotice:"notice" }));
vi.mock("../use-product-return", () => ({ useProductReturn: () => "/catalog" }));
vi.mock("../auth-client", () => ({ authRequest: state.request, feedbackFromError: () => ({kind:"error",message:"Попробуйте ещё раз."}) }));
import ForgotPasswordPage from "./forgot-password-screen";
function render() { state.cursor=0;return ForgotPasswordPage(); }
function find(node: ReactNode, type: string): any {
  if(Array.isArray(node))return node.map(child=>find(child,type)).find(Boolean);
  if(!isValidElement<{children?:ReactNode}>(node))return undefined;
  return node.type===type ? node.props : find(node.props.children,type);
}
const event={preventDefault:vi.fn()};
beforeEach(()=>{state.slots=[];state.cursor=0;state.request.mockReset();});
it("opens an empty recovery form independently from login fields and validates only its own submit", async()=>{
  let page=render();expect(find(page,"input").value).toBe("");expect(find(page,"field").validationState).toBe("none");
  expect(find(page,"button").children).toBe("Отправить письмо");
  await find(page,"form").onSubmit(event);page=render();
  expect(find(page,"field").validationState).toBe("error");expect(state.request).not.toHaveBeenCalled();
});
it("normalizes email, prevents duplicate submission and keeps a neutral success", async()=>{
  let resolve!: (value:unknown)=>void;
  state.request.mockImplementation(()=>new Promise(r=>{resolve=r;}));
  find(render(),"input").onChange(null,{value:"  Test@Example.com  "});
  const page=render(),first=find(page,"form").onSubmit(event);await find(page,"form").onSubmit(event);
  expect(state.request).toHaveBeenCalledTimes(1);expect(state.request).toHaveBeenCalledWith("/auth/password/forgot",{email:"test@example.com"});
  const button=find(render(),"button");
  expect(button.disabled).toBe(true);expect(button["aria-busy"]).toBe(true);
  expect(find(button.children,"loading").label).toBe("Отправляем письмо…");
  resolve({ok:true,message:"Accepted",delivery:"PROVIDER"});await first;
  expect(find(render(),"notice").feedback.message).toContain("Если аккаунт");
  expect(find(render(),"button").children).toBe("Отправить письмо");
  expect(find(render(),"button")["aria-busy"]).toBe(false);
});
it("retains the email on delivery errors and permits a deliberate retry", async()=>{
  state.request.mockRejectedValueOnce(new Error("timeout"));
  find(render(),"input").onChange(null,{value:"test@example.com"});await find(render(),"form").onSubmit(event);
  const page=render();expect(find(page,"input").value).toBe("test@example.com");expect(find(page,"notice").feedback.kind).toBe("error");
  expect(find(page,"button").disabled).toBe(false);
  state.request.mockResolvedValue({ok:true,message:"Accepted",delivery:"LOCAL_FILE"});await find(page,"form").onSubmit(event);
  expect(find(render(),"notice").feedback.message).toContain("локальном стенде");
});
