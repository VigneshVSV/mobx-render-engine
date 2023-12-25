import { ContextfulApp } from "./components/app"
import { ContextfulPage } from "./components/page"
import { RenderEngine } from "./index"



export function prepareRenderers(renderers : RenderEngine[]) {
    for (let renderer of renderers){
        renderer.registerComponent("__App__", ContextfulApp)
        renderer.registerComponent("ContextfulPage", ContextfulPage)
    }
}