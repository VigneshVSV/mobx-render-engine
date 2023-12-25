// Internal & 3rd party functional libraries
import { observer } from "mobx-react-lite"
// Custom functional libraries
// Internal & 3rd party component libraries
// Custom component libraries
import { RenderEngineComponentProps } from "../index"



export const ContextfulApp = observer(({state, renderer, logger} : RenderEngineComponentProps) => {

    const ErrorBackdrop = renderer.stateManager.errroBackdrop
    const children = state.computedChildren
    logger.logMounting('ContextfulApp', 'App')
  
    try{
        return (
            <>  
                {renderer.Children(children)}
            </>
            )
    } catch(error : any) {
        return (
            <ErrorBackdrop
                message="dashboard could not render due to error : "
                subMessage={error.message}
                goBack={() => renderer.stateManager.actionDispatcher.hooks["setGlobalLocation"]('/')}
            />
        )
    }
})