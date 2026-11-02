import { registerRootComponent } from "expo";
import { createElement } from "react";
import NativeMarketApp from "./src/NativeMarketApp";

registerRootComponent(() => createElement(NativeMarketApp));
