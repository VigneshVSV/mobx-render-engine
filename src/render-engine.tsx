// Internal & 3rd party functional libraries
import React from "react";
// Custom functional libraries
// Internal & 3rd party component libraries
// Custom component libraries
import { ComponentStateMap, PlotlyState } from "./state-container";
import { Logger } from "./utils/logger";
import { ComponentState } from "./state-container";



export type RenderEngineComponentProps = {
    state : ComponentState
    renderer : RenderEngine
    logger : Logger  
}

export type RenderEnginePlotlyProps = {
    state : PlotlyState
    renderer : RenderEngine
    logger : Logger  
}

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

    constructor(id : string, logger : Logger, stateManager : any, componentStateMap : ComponentStateMap, 
                    setGlobalLocation : any, errorBoundary : JSX.Element) {
        this.id = id 
        this.logger = logger
        this.components = {}
        this.stateManager = stateManager
        this.componentStateMap = componentStateMap // called from init from stateManager, component state map is not yet available 
        this.setGlobalLocation = setGlobalLocation
        this._stopRendering = false
        this._lastError = ''
        this.errorBoundary = errorBoundary
    }

    Component(id : string) : string | number | null | JSX.Element {
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
                // @ts-ignore     
                <ErrorBoundary
                    message='could not resolve id __App__ although this should have been possible'
                    subMessage='did you quit while loading a page from server in between? You need to reload the page from server'
                    goBack={() => this.setGlobalLocation('/')}
                />
            } 
            return id
    }

    registerComponent(name : string, component : any, replace : boolean = false) {
        if(!this.components[name] || replace)
            this.components[name] = component
        else if(!replace)
            throw new Error(`component with name ${name} already present in list of renderable components`)
    }

    deregisterComponent(name : string) {
        if(this.components[name])
            delete this.components[name]
    }

    isCapable(name : string) : boolean {
        if(this.components.hasOwnProperty(name)) 
            return true 
        return false
    }

    Children(children : string[] | null) {
        return (
            <>
                {children? children.map((child : string) => this.Component(child)) : null}
            </>
        )
    }
}





