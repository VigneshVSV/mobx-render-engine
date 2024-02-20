// Internal & 3rd party functional libraries
import React from "react";
// Custom functional libraries
// Internal & 3rd party component libraries
// Custom component libraries
import { ComponentStateMap, PlotlyState } from "./state-container";
import { Logger } from "./utils/logger";
import { ComponentState } from "./state-container";


/**
 * Type for props of a component to be registered with render engine. All components 
 * are passed these three props by the render engine along with a unique key.   
 */ 
export type RenderEngineComponentProps = {
    state : ComponentState
    renderer : RenderEngine
    logger : Logger  
}


/**
 * Checks if supplied html-id has a defined component state and renders it with that 
 * state if possible. RenderEngine keeps a map of allowed components which can be 
 * registered using `registerComponent()`. For a given html-id, it retrives the component from the map, 
 * and passes the MobX state while rendering. Additional errors while rendering can be shown using error boundary. 
 */
export class RenderEngine {

    id : string 
    logger : Logger 
    componentStateMap : ComponentStateMap
    components : { [key : string] : any }
    setGlobalLocation : any
    stateManager : any
    errorBoundary : JSX.Element
    _stopRendering : boolean
    _lastError : string

    /**
     * Creates a new RenderEngine. For each application, normally one is sufficient. 
     * @param id id of the render engine, used for logging
     * @param logger instance of mobx-render-engine/utils/Logger or similar
     * @param stateManager parent state manager that owns the render engine, automatically assigned when createStateManager is used
     * @param componentStateMap html-id to ComponentState map
     * @param setGlobalLocation gives error boundary a way to return to the calling page
     * @param errorBoundary component that is displayed when error occured while rendering the components
     */

    constructor(id : string, logger : Logger, stateManager : any, componentStateMap : ComponentStateMap, 
                    setGlobalLocation : (absolutePath : string) => void, errorBoundary : JSX.Element) {
        this.id = id 
        this.logger = logger
        this.components = {}
        this.stateManager = stateManager
        this.componentStateMap = componentStateMap // called from init from stateManager, component state map is not yet available 
        this.setGlobalLocation = setGlobalLocation
        this.errorBoundary = errorBoundary
        this._stopRendering = false
        this._lastError = ''
    }

    /**
     * renders component specified by html-id. If state is not found, tries to render 
     * it plain (like numbers, strings etc.). Stops rendering if encountered with 
     * error while rendering. 
     * @param id html-id of a specific component whose JSX needs to be returned
     * @returns react node
     */
    Component(id : string) : React.ReactNode {
        // debugger
        if(this._stopRendering)
            throw new Error(this._lastError)
        if(typeof id !== 'string') {
            // not a valid ID, its something else, probably a raw value like string or integer which is used a textfield.
            // render it blindly for the user to see the error if any
            return id
        }
        let state = this.componentStateMap[id]
        if (state) {
            const key = state.tree.replace(new RegExp('/','g'), '__')
            if(this.isCapable(state.componentName)) {
                let Component = this.components[state.componentName]
                let ErrorBoundary = this.errorBoundary
                try {
                    return (
                        <Component key={key} state={state} renderer={this} logger={this.logger} />
                    )    
                } catch(error : any) {
                    this._lastError = error.message
                    this.logger.logErrorMessage("Renderer", this.id, this._lastError)
                    this._stopRendering = true
                    return (
                        // @ts-ignore
                        <ErrorBoundary
                            message={error.message}
                            subMessage='cannot continue rendering'
                            goBack={() => this.setGlobalLocation('/')}
                        />
                    )
                }
            }
            else {
                this._lastError = `possibly an unknown or yet unsupported component trying to render - id : ${id} component : ${state.componentName}`
                this.logger.logErrorMessage("Renderer", this.id, this._lastError)
                this._stopRendering = true
                return (
                    // @ts-ignore 
                    <ErrorBoundary
                        message={this._lastError}
                        subMessage='try to register the component with current componentName'
                        goBack={() => this.setGlobalLocation('/')}
                    />
                )
            }
        }
        else
            // probably a raw string which is used in a textfield, render it blindly 
            if(id === '__App__') {
                this._stopRendering = true    
                return (
                    // @ts-ignore 
                    <ErrorBoundary
                        message='could not resolve id __App__ although this should have been possible'
                        subMessage='did you quit while loading a page from server in between? You need to reload the page from server'
                        goBack={() => this.setGlobalLocation('/')}
                    />
                )
            } 
            return id // plain render
    }

    /**
     * supply a new component to be made available for rendering
     * @param name unqiue name
     * @param component component
     * @param replace replace when true if another component was registered with same name
     * @throws if replace is false and a component was already registered with given name
     */
    registerComponent(name : string, component : any, replace : boolean = false) {
        if(!this.components[name] || replace)
            this.components[name] = component
        else if(!replace)
            throw new Error(`component with name ${name} already present in list of renderable components`)
    }

    /**
     * remove an existing renderable component
     * @param name remove a registered component with given name. No effect when name does not exist 
     */
    deregisterComponent(name : string) {
        if(this.components[name])
            delete this.components[name]
    }

    /**
     * 
     * @param name check if a given name is already registered
     * @returns true if capable
     */

    isCapable(name : string) : boolean {
        if(this.components.hasOwnProperty(name)) 
            return true 
        return false
    }

    /**
     * render an array of components using the array of html-ids. Mainly useful for rendering children.
     * @param children array of html-ids
     * @returns array of react nodes within a react fragment
     */
    Children(children : string[] | null) : React.ReactNode {
        return (
            <>
                {children? children.map((child : string) => this.Component(child)) : null}
            </>
        )
    }
}


console.log("%cMOBX RENDER ENGINE %c\n \
To contribute visit:\n \
https://github.com/VigneshVSV/mobx-render-engine\n \
https://github.com/VigneshVSV/hololinked-dashboard-components\n \
https://github.com/VigneshVSV/MUI-mobx-react-render-engine",
"color:green; font-size: 50px", "color:red; font-size:15px" )




