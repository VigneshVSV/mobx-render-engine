// Internal & 3rd party functional libraries
import axios, { AxiosPromise, AxiosRequestConfig, AxiosResponse } from "axios";
// Custom functional libraries
import { ComponentData, ComponentState, ComponentStateMap, PlotlyComponentData, VideoComponentData, 
    PlotlyState, VideoComponentState, PageState } from "./state-container"
import { RemoteFSMMap } from "./state-machine"
import { ACTION, NESTED, ActionsMap, ComponentOutputMap, StubEvaluator, Stub } from "./stub-evaluator"
import { RenderEngine } from "./index"
import { Logger, loglevels } from "./utils/logger"
import { asyncRequest } from "./utils/http"
import { sleep, timestamp } from "./utils/misc"
import { loadCurrentDashboard, openDatabase, storeCurrentDashboard } from "./utils/browser-db";



function isDynamicObj(data : any) : boolean {
    if (data.hasOwnProperty('op1') && data.hasOwnProperty('op1dtype') && data.hasOwnProperty('op1interpretation'))
        return true 
    return false 
}


type Hooks = {
    setLocation? : (relativePath : string) => void
    setGlobalLocation? : (absolutePath : string) => void
}

type ErrorBoundaryProps = {
    message : string
    subMessage : string 
    goBack : (absolutePath : string) => void
}


/** 
 * Main object to manage application state for a single application, webpage or dashboard.
 * It composes a renderer, an action dispatcher, a component state map and a component output map. 
 * Use `createStateManager()` method to instantiate this object with default settings. 
 * Call `updateComponents()` and `updateActions()` with [JSON specification](https://www.google.com) 
 * to create component states and actions. The renderer will be then able to render such components. 
 * Read [quickstart](https://www.google.com) or implementation of 
 * [mui-mobx-render-engine](https://github.com/VigneshVSV/mui-render-engine) 
 * or [hololinked-dashboard-components](https://github.com/VigneshVSV/hololinked-dashboard-components) for examples.
 */
export class StateManager {

    _componentStateMap! : ComponentStateMap
    _componentOutputMap! : object 
    _remoteFSMMap! : RemoteFSMMap
    id : string
    logger : Logger 
    renderer : RenderEngine
    actionDispatcher : ActionDispatcher
    stubEvaluator : StubEvaluator
    stubResolver : any 

    /**
     * prefer `createStateManager()`
     * @param id an id for the state manager, used for logging
     * @param logger instance of mobx-render-enginer/utils/Logger
     * @param componentStateMap - object (can be empty) 
     * @param componentOutputMap - object (can be empty) 
     * @param remoteFSMMap - object (can be empty) 
     * @param errorBoundary - component rendered if there is an error (should accept 'message', 
     *                      'submessage' and 'goBack' location router function)
     * @param hooks - pass setLocation (relative), setGlobalLocation
     */
    constructor(id : string, logger : Logger, componentStateMap : ComponentStateMap, 
                componentOutputMap : ComponentOutputMap, remoteFSMMap : RemoteFSMMap, 
                errorBoundary : React.ReactElement<ErrorBoundaryProps>, hooks : Hooks = {}) { 
        this.id = id
        this.logger = logger
        this.componentStateMap = componentStateMap
        this.componentOutputMap = componentOutputMap
        this.remoteFSMMap = remoteFSMMap
        this.renderer = new RenderEngine(`${this.id}-renderer`, this.logger, this, 
                                            componentStateMap, hooks.setGlobalLocation!, errorBoundary)
        this.actionDispatcher = new ActionDispatcher(`${this.id}-action-dispatcher`, 
                                    new Logger(`${this.id}-action-dispatcher`, 'INFO'),
                                    this, componentOutputMap, remoteFSMMap,
                                    hooks)
        this.stubEvaluator = new StubEvaluator(`${this.id}-stub-evaluator`, this.actionDispatcher.logger, 
                                        componentOutputMap, this.actionDispatcher)
        this.stubResolver  = this.stubEvaluator.resolveStubInfo.bind(this.stubEvaluator)
    }

    /** 
     * one time set object with key-value pairs of component html id and ComponentState 
     */
    set componentStateMap(value : ComponentStateMap | null) {
        if(!value) 
            return
        if(this._componentStateMap)
            throw new Error("Cannot modify global state map once its set")
        else 
            this._componentStateMap = value
    }

    /** 
     * one time set object with key-value pairs of component html id and 
     * its value (say for input elements like textfield, checkbox etc.) 
     */
    set componentOutputMap(value : object | null) {
        if(!value) 
            return
        if(this._componentOutputMap)
            throw new Error("Cannot modify global state map once its set")
        else 
            this._componentOutputMap = value
    }

    /** 
     * one time set object with key-value pairs of a hololinked.server.RemoteObject 
     * and its state machine state. Not useful for applications outside hololinked. 
     */
    set remoteFSMMap(value : RemoteFSMMap | null) {
        if(!value) 
            return 
        if(this._remoteFSMMap)
            throw new Error("cannot modify remote FSM map once its set")
        else 
            this._remoteFSMMap = value
    }

    get componentStateMap() : ComponentStateMap {
        return this._componentStateMap
    }

    get componentOutputMap() : ComponentOutputMap {
        return this._componentOutputMap
    }

    get remoteFSMMap() : RemoteFSMMap {
        return this._remoteFSMMap
    }

    /**
     * creates component state from data, used updateComponents() when componentStateMap does not have a ComponentState
     * for a specific html-id. 
     * @param data - object containing the state data
     * @returns ComponentState (implementor of makeObservable) or its child class
     */
    createComponentState(data : ComponentData | PlotlyComponentData | VideoComponentData){
        if (data.componentName === '__App__' || this.renderer.isCapable(data.componentName)){
            switch(data.componentName) {
                case 'ContextfulPlotlyGraph' : return new PlotlyState(data as PlotlyComponentData, this.stubResolver)
                case 'ContextfulSSEVideo' : return new VideoComponentState(data as VideoComponentData, this.stubResolver)
                case 'ContextfulPage' : return new PageState(data as ComponentData, this.stubResolver, this._componentStateMap)
                default : return new ComponentState(data as ComponentData, this.stubResolver); 
            }    
        }
        else
            throw new Error(`unknown component name : '${data.componentName}' - cannot create state container.`);
    }

    /**
     * @private
     * finds the data providers for a dynamic prop, here resolve means 'find what provides it'
     * @param data dynamic object data (contains fields op1, op1dtype, op1interpretation among others )
     * @returns a list of providers (html ids of data providers and actions ids whose return value matter)
     */
    _resolveDynamicObj(data : { [key : string] : any }) : string[] {
        let providers : string[] = []
        // debugger
        if (data.op1interpretation === NESTED ) {
            let providers_ = this._resolveDynamicObj(data.op1) 
            providers.push(...providers_)
        }   
        else if (data.op1interpretation !== ACTION)  // RAW or ACTION_RESULT
            providers.push(data.op1)
            
        if (data.hasOwnProperty('op2') && data.hasOwnProperty('op2dtype') 
                && data.hasOwnProperty('op2interpretation')) {
            if (data.op2interpretation === NESTED) {
                let providers_ = this._resolveDynamicObj(data.op2) 
                providers.push(...providers_)
            }
            // we dont check ACTION like the previous if-else clause 
            // because ACTION stub has only one operand
            else 
                providers.push(data.op2)
        }
        return providers
    }        

    /**
     * @private
     * called for props, state machine and children objects to find props or children which
     * are supposed to be dynamically generated from values of other components (for example, input components
     * like checkbox and slider). calls _resolveDynamicObj internally. 
     * @param data key-value pairs/object 
     * @returns list of dynamic fields within that object and the providers of data for them. 
     */
    _getDynamicFieldsWithProvidersForGivenObject (data : { [key : string] : any }) : { providers_ : string[], dynamicFields_ : string[] } {
        let providers : string [] = []
        let dynamicFields : string[] = []
        if(Array.isArray(data)) {
            for (let obj of data) {
                if (typeof obj === 'object') {
                    if (isDynamicObj(obj)) {
                        if(obj.op1interpretation === ACTION)
                            obj = this.stubResolver(obj)
                        else {
                            let providers_ = this._resolveDynamicObj(obj)
                            providers.push(...providers_)
                        }
                    }
                    else  {
                        let { providers_, dynamicFields_} = this._getDynamicFieldsWithProvidersForGivenObject(obj)
                        providers.push(...providers_)
                        dynamicFields.push(...dynamicFields_)
                    }
                }
            }
        }
        else {
            // objects like component props reach here first 
            // and propagate their members to array logic, 
            // nested objects etc. Plain prop values like string, number etc. stay as they are. 
            for (let key of Object.keys(data)) {
                if (typeof data[key] === 'object' && data[key]) {
                    if (isDynamicObj(data[key])) {
                        if(data[key].op1interpretation === ACTION) 
                            data[key] = this.stubResolver(data[key])
                        else {
                            let providers_ = this._resolveDynamicObj(data[key])
                            providers.push(...providers_)
                            dynamicFields.push(key)
                        }
                    }
                    else {
                        // arrays and everything else reach here 
                        let { providers_, dynamicFields_} = this._getDynamicFieldsWithProvidersForGivenObject(data[key])
                        if(providers_.length > 0 && Array.isArray(data[key]))
                            dynamicFields.push(key)
                        providers.push(...providers_)
                        dynamicFields.push(...dynamicFields_)
                    }
                }
            }
        }
        return {
            providers_ : providers,
            dynamicFields_ : dynamicFields        
        }
    }


    /**
     * @private
     * finds dynamicProps and dynamicChildren - props and children to be dynamically 
     * generated from values of other components (for example, input components like checkbox and slider)
     * @param componentData object containing component data
     * @returns list of data providers for dynamicProps or dynamicChildren
     */
    getDynamicDataProviders (componentData : ComponentData | PlotlyComponentData) : string[] {
        let providers : string[] = []
        
        if(componentData.props){
                // debugger
                let { providers_, dynamicFields_ } = this._getDynamicFieldsWithProvidersForGivenObject(componentData.props)
                providers.push(...providers_)
                for (let dprop of dynamicFields_) {
                    if(!componentData.dynamicProps)
                    componentData.dynamicProps = {}
                componentData.dynamicProps[dprop] = componentData.props[dprop]
                delete componentData.props[dprop]
            }
        }
        
        if(componentData.children){
            let dynamicChildIndexToRemove : number[] = []
            for(let i=0; i < componentData.children.length; i++) {
                let { providers_, dynamicFields_ } = this._getDynamicFieldsWithProvidersForGivenObject(componentData.children[i])
                providers.push(...providers_)
                if(providers_.length > 0){
                    if(!componentData.dynamicChildren)
                        componentData.dynamicChildren = []
                    componentData.dynamicChildren.push(componentData.children[i]) 
                    dynamicChildIndexToRemove.push(i)
                }
            }
            for(let index of dynamicChildIndexToRemove){
                componentData.children.splice(index, 1)
            }                
        }
        
        if((componentData as PlotlyComponentData).sources){
            // debugger
            let { providers_, dynamicFields_ } = this._getDynamicFieldsWithProvidersForGivenObject(
                                            (componentData as PlotlyComponentData).sources)
            providers.push(...providers_)
        }
        
        if (componentData.stateMachine) {
            // debugger
            for(let state of Object.keys(componentData.stateMachine.states)){                 
                let {providers_, dynamicFields_} = this._getDynamicFieldsWithProvidersForGivenObject(componentData.stateMachine.states[state])
                providers.push(...providers_)
                if(!componentData.stateMachine.states[state].props)
                    componentData.stateMachine.states[state].props = {}
                if(!componentData.stateMachine.states[state].dynamicProps)
                    componentData.stateMachine.states[state].dynamicProps = {}
                for (let dprop of dynamicFields_) {
                    // @ts-ignore
                    componentData.stateMachine.states[state].dynamicProps[dprop] = componentData.stateMachine.states[state][dprop]
                    // @ts-ignore
                    delete componentData.stateMachine.states[state][dprop]
                }
                for (let key of Object.keys(componentData.stateMachine.states[state])) {
                    if(key !== 'props' && key !== 'dynamicProps' && key !== 'onEntry' && key !== 'onExit' && key !== 'onExitTo'
                        && key !== 'children' && key !== 'dynamicChildren') {
                        // @ts-ignore
                        componentData.stateMachine.states[state].props[key] = componentData.stateMachine.states[state][key]
                        // @ts-ignore
                        delete componentData.stateMachine.states[state][key]
                    }
                }
            } 
        } 
        
        return providers
    }   

    /**
     * @private
     * creates or modifies a ComponentState. calls setComponentData MobX action on ComponentState.
     * @param id html-id of component for which a state has to be created or modified
     * @param state object containing state information
     * @param added a list into which html-id is added if created freshly (optional)
     * @param reset a list into which html-id is added if component already existed (optional)
     */
    _addOrModifyComponentState(id : string, state : ComponentData | PlotlyComponentData 
                                | VideoComponentData, added : string[] | null = null, reset : string[] | null = null){
        if (this._componentStateMap[id]) {
            this._componentStateMap[id].setComponentData(state)
            if(reset !== null)
                reset.push(id)
        }
        else {
            this._componentStateMap[id] = this.createComponentState(state) 
            if( this._componentStateMap[id].stateMachine) {
                // debugger
                this._componentStateMap[id].stateMachine.registerStateMap(this._remoteFSMMap)
                if(!this._remoteFSMMap[this._componentStateMap[id].stateMachine._subscribedField])
                    this._remoteFSMMap[this._componentStateMap[id].stateMachine._subscribedField] = {
                        state : '',
                        subscribers : []
                    }
                if(!this._remoteFSMMap[this._componentStateMap[id].stateMachine._subscribedField].subscribers.includes(id))
                    this._remoteFSMMap[this._componentStateMap[id].stateMachine._subscribedField].subscribers.push(id)  
                this._componentStateMap[id].stateMachine.transition()
            }
            if(added !== null)
                added.push(id)
        } 
    }

    /**
     * 
     * @param data 
     * @param callerID 
     */
    updateComponents(data : any, callerID : string = '') {
        // debugger
        this.logger.drawLine()
        this.logger.logStateMap("StateManager", this.id, "PREVIOUS STATE       ", this._componentStateMap)
        this.logger.logData    ("StateManager", this.id, "BACKEND DATA         ", data)
        let reset : string[] = [], added : string[] = []
            
        // update dependents from new data
        let providersMap : any = {}
        for(let key of Object.keys(data)) {
            // debugger
            let providers = this.getDynamicDataProviders(data[key])  
            providers = [...new Set(providers)]
            if(providers.length > 0) {
                // this.logger.logTraceMessage("StateMapManager", this.id, `component with id ${key} has providers ${providers}`)
                for (let i=0; i < providers.length; i++) {
                    let providerID = providers[i]
                    if(data[providerID] || this._componentStateMap[providerID] || this.stubEvaluator.actionStubsMap[providerID]) {
                        if(providersMap[providerID]) 
                            providersMap[providerID].dependents.push(key)                        
                        else 
                            providersMap[providerID] = { dependents : [key] }
                    }
                }
            }
        }
        
        this.logger.logData("StateManager", this.id, "PROVIDERS (to be updated)", providersMap)
        // update providers to actionMap
        for(let key of Object.keys(providersMap)){
            // debugger
            if(this.stubEvaluator.actionStubsMap.hasOwnProperty(key) ){
                if(this.stubEvaluator.actionStubsMap[key].dependents)
                    this.stubEvaluator.actionStubsMap[key].dependents.push(...providersMap[key].dependents)
                else 
                    this.stubEvaluator.actionStubsMap[key].dependents = [...providersMap[key].dependents] 
                this.stubEvaluator.actionStubsMap[key].dependents = [...new Set(this.stubEvaluator.actionStubsMap[key].dependents)] 
                // regarding above ensure uniqueness in case the complicated logics from before screws it up 
                // @ts-ignore 
                if(this.actionDispatcher.actions[key]) {
                    this.actionDispatcher.actions[key].dependents = this.stubEvaluator.actionStubsMap[key].dependents
                }
            }
        }
        this.logger.logData("StateManager", this.id, "ACTIONS (to be updated)", this.stubEvaluator.actionStubsMap)
        
        // create or update component states
        for(let key of Object.keys(data) ) {
            //always update App at the end because it should be the first consumer of the component state map 
            if (key !== "__App__" && key!== callerID) {
                this._addOrModifyComponentState(key, data[key], added, reset)
            }
        }   
        
        // Not sure, but I think it was observed that while updating the own component which made the request before
        // updating other components causes problems
        if(data.hasOwnProperty(callerID) && this._componentStateMap.hasOwnProperty(callerID)) {
            this._addOrModifyComponentState(callerID, data[callerID], added, reset)             
        }
           
        if(data["__App__"]) {
            this._addOrModifyComponentState("__App__", data["__App__"], added, reset)   
        }
        
        this.logger.logStateMap      ("StateManager", this.id, "NEXT STATE           ", this._componentStateMap)
        this.logger.logComponentsList("StateManager", this.id, "COMPONENTS ADDED     ", added)
        this.logger.logComponentsList("StateManager", this.id, "COMPONENTS RESET     ", reset)
        this.logger.drawLine()
    }

   
    /**
     * delete the component state map
     */
    deleteComponents() {
        for(let key of Object.keys(this._componentStateMap))
            delete this._componentStateMap[key]
    }

    /**
     * add all action JSON specifications to an internal map of stub evaluator which resolves it (the JSON stub
     * or specification) into a function. call this method before calling updateComponents().
     * @param data key-value pairs/object
     */
    updateActions (data : ActionsMap) {
        this.logger.logData("StateManager", this.id, "ACTIONS (to be updated)", data)
        for(let key of Object.keys(data)) 
            this.stubEvaluator.actionStubsMap[key] = data[key]
    }

    /**
     * delete the internal actions map within stub evaluator
     */
    deleteActions () {
        for(let key of Object.keys(this.stubEvaluator.actionStubsMap))
            delete this.stubEvaluator.actionStubsMap[key]
    }

    get resolvedActions () : Action[] {
        let actions : Action[] = []
        for(let key of Object.keys(this.stubEvaluator.actionStubsMap)){
            this.stubResolver({
                op1 : key, 
                op1interpretation : ACTION,
                op1dtype : ACTION                     
            })     
            actions.push(this.actionDispatcher.actions[key])       
            this.actionDispatcher.actions[key].dependents = this.stubEvaluator.actionStubsMap[key].dependents
        }
        // debugger
        return actions
    }


    forceUpdateDependents (dependents : string[] | null | undefined) {
        if(dependents){
            for(let i=0; i < dependents.length; i++) {
                if(this._componentStateMap.hasOwnProperty(dependents[i]))    
                    this._componentStateMap[dependents[i]].forceUpdate()
            }
        }
    }


    store (server : string, components : any, actions : any, storeAsLastUsed : boolean = true) {
        let clonedActions = structuredClone(actions)
        let clonedComponents = structuredClone(components)
        openDatabase()
        let dataToCommit = [{
                id : server, 
                components : clonedComponents,
                actions : clonedActions,
        }]
        if(storeAsLastUsed){
            dataToCommit.push({
                    id : 'last-used', 
                    components : clonedComponents,
                    actions : clonedActions,
            })
        }
        storeCurrentDashboard(dataToCommit)
    }

    async load(server : string) {
        let data = await loadCurrentDashboard(server)
        if(data){
            this.updateActions(data.actions)
            this.updateComponents(data.components)
        }
    }


    reset() {
        this.actionDispatcher.reset()
        this.deleteActions()
        this.deleteComponents()
        this._componentOutputMap = {}
        this._componentStateMap = {}
        this._remoteFSMMap = {}
        this.logger.clearLogs()
        console.debug("reset state manager with id - ", this.id)
    }
}


export function createStateManager(id : string, logLevel : string = 'DEBUG', errorBoundary : React.ReactElement<ErrorBoundaryProps>, hooks : Hooks = {}) : StateManager {
    const visualizationComponentStateMap : ComponentStateMap = {}
    const visualizationComponentOutputMap : ComponentOutputMap = {}
    const visualizationRemoteFSMMap : RemoteFSMMap = {}
    const visualizationLogger = new Logger(`${id}-logger`, logLevel as loglevels)
    const visualizationStateManager = new StateManager(
        id, 
        visualizationLogger, 
        visualizationComponentStateMap, 
        visualizationComponentOutputMap, 
        visualizationRemoteFSMMap,
        errorBoundary,
        hooks
    )
    return visualizationStateManager
}



export type BaseAction = {
    id : string 
    type : string 
    dependents? : string[]
}

export type SingleRequestConfig = {
    config : AxiosRequestConfig
} & BaseAction

export type QueuedRequestConfig = {
    type : string 
    id : string 
    requests : SingleRequestConfig[]
    ignoreFailedRequests : boolean
} & BaseAction

export type ParallelRequestsConfig = {
    type : string 
    id : string 
    requests : SingleRequestConfig[]
} & BaseAction

export type RepeatedRequestConfig = {
    type : string 
    id : string 
    requests : SingleRequestConfig | QueuedRequestConfig | ParallelRequestsConfig
    ignoreFailedRequests? : boolean
    dependents? : string[]
    interval : number
} & BaseAction

export type SSEConfig = {
    URL  : string
} & BaseAction

export type CancelAction = {
    cancelID : string 
} & BaseAction

export type SetLocationType = {
    path : string
} & BaseAction

export type SetComponentStateType = {
    componentID : string 
    state : string
} & BaseAction


export class ActionDispatcher {

    id : string 
    logger : Logger 
    stateManager : StateManager
    componentOutputMap : ComponentOutputMap
    remoteFSMMap : RemoteFSMMap
    actions : { [key : string] : Action }
    lastPythonError : any
    lastRequestMap : {
        [key : string] : {
            config : any,
            response : AxiosResponse
        }
    }
    hooks : Hooks

    constructor(id : string, logger : Logger, stateManager : StateManager, componentOutputMap : ComponentOutputMap,
                    remoteFSMMap : RemoteFSMMap, hooks : any = {}) {
        this.id = id  
        this.logger = logger 
        this.stateManager = stateManager
        this.componentOutputMap = componentOutputMap 
        this.remoteFSMMap = remoteFSMMap
        this.actions = {}
        this.lastPythonError = null 
        this.lastRequestMap = {}
        this.hooks = hooks
    }

    resolveAction(actionInfo : BaseAction) : [Action, Function | null] {
        let action : Action 
        let executable : Function | null = null 
        // console.log('action-dispatcher', this.id, `created action of type ${actionInfo.type} with dependents ${actionInfo.dependents}`)
        switch(actionInfo.type) {
            case "SingleHTTPRequest" : action = new HTTPRequest(actionInfo as SingleRequestConfig, this); break;
            case "QueuedHTTPRequests" : action = new QueuedHTTPRequest(actionInfo as QueuedRequestConfig, this); break; 
            case "ParallelHTTPRequests" : action = new ParallelHTTPRequests(actionInfo as ParallelRequestsConfig, this); break; 
            case "RepeatedRequests"  : action = new RepeatedRequests(actionInfo as RepeatedRequestConfig, this); break; 
            case "SSE"               : action = new SSE(actionInfo as SSEConfig, this); break;
            case "SSEVideo"          : action = new SSEVideo(actionInfo as SSEConfig, this); break;

            case "componentOutput"   :  
                                        // @ts-ignore
                                        action = new ComponentOutput(actionInfo, this); 
                                        // @ts-ignore
                                        executable = (value : any) => (action as Action).call(value)
                                        break;

            case "setLocation"       : action = new SetLocation(actionInfo as SetLocationType, this); break
            case "setGlobalLocation" : action = new SetGlobalLocation(actionInfo as SetLocationType, this); break;
            case 'Cancel'            : action = new Cancel(actionInfo as CancelAction, this); break;
            case 'setComponentSimpleFSMState' : action = new SetComponentSimpleFSMState((actionInfo as SetComponentStateType), this); break;

            case 'setComponentSimpleFSMDynamicState' : 
                                        // @ts-ignore
                                        action = new SetComponentSimpleFSMDynamicState((action as SetComponentStateType), this)
                                        // @ts-ignore
                                        executable = (value : any) => (action as Action).call(value)
                                        break;
            
            default : action = new UnresolvedAction((actionInfo as BaseAction), this); break;
        }  
        return [action, executable]
    }

    createNew (actionInfo : BaseAction) {
        let [action, executable] = this.resolveAction(actionInfo) 
        this.actions[actionInfo.id] = action 
        if(!executable){
            if(action.call.constructor.name === 'AsyncFunction')
                executable = async() => await (action as Action).call()
            else 
                executable = () => (action as Action).call()
        }
        return executable
    }

    reset() {
        this.cancelAll()
        this.actions = {}
        this.lastPythonError = null 
        this.logger.clearLogs()
    }

    cancel(id : string) {
        try {
            if(this.actions[id] instanceof Action)
                // @ts-ignore
                this.actions[id].cancel()
        } catch(error) {
            this.logger.logErrorMessage('cancel', 'cancel', 'could not cancel action')
        }
    }

    cancelAll() {
        for(let key of Object.keys(this.actions)) {
            this.cancel(key)
        }
    }

    deepUpdateDynamicValues = (data : any) : any => {
        for (let key of Object.keys(data)) {
            if (typeof data[key] === 'object' && data[key]) {
                if (data[key].hasOwnProperty('op1') && data[key].hasOwnProperty('op1dtype') && data[key].hasOwnProperty('op1interpretation')) 
                    // @ts-ignore
                    data[key] = this.stateManager.stubResolver(data[key])                
                else
                    this.deepUpdateDynamicValues(data[key])
            }
        }
        return data
    }

    commitDataToState(id : string, response : AxiosResponse, dependents : string[] | null | undefined) {
        // debugger
        if(response.data.state) {
            this.updateRemoteFSM(response.data.state)
            this.logger.logInfoMessage('ActionDispatcher', this.id, 'updated Remote FSM map with data', response.data.state)
            delete response.data.state
        }
        if(response.data.returnValue) {
            if(response.data.returnValue.actions) {
                this.stateManager.updateActions(response.data.returnValue.actions)
                this.logger.logInfoMessage('ActionDispatcher', this.id, 'updated actions', response.data.returnValue.actions)
                delete response.data.returnValue.actions
            }
            if(response.data.returnValue.UIcomponents) {
                this.stateManager.updateComponents(response.data.returnValue.UIcomponents)
                this.logger.logInfoMessage('ActionDispatcher', this.id, `updated UI components`, response.data.returnValue.UIcomponents)
                delete response.data.returnValue.UIcomponents
            }
            if (response.data.returnValue) 
                this.updateComponentOutputMap(id, response.data.returnValue, dependents)               
        }
        if(response.data.exception){
            this.lastPythonError = response.data.exception
            this.lastPythonError.timestamp = timestamp()
            this.lastPythonError.request = response.config
        }
        if(response.config && response.data.state) {
            for(let key of Object.keys(response.data.state)) {
                this.lastRequestMap[key] = {
                    config : response.config,
                    response : response.data                    
                } 
            }
        }
    }

    updateComponentOutputMap(id : string, data : any, dependents : string[] | undefined | null) {
        this.componentOutputMap[id] = data
        this.logger.logDebugMessage("ActionDispatcher", this.id, `componentOutputMap updated with value`, this.componentOutputMap[id])
        if(dependents) {
            this.stateManager.forceUpdateDependents(dependents)
        }
    }

    updateRemoteFSM (states : { [key : string] : string}) {
        // update backend state machine information
        for(let [key, val] of Object.entries(states)) {
            if(!this.remoteFSMMap[key]) {
                this.logger.logWarnMessage("ActionDispatcher", this.id, `did not find any subscribers to ${key}, you are probably making 
                    a useless request`)
                this.remoteFSMMap[key] = {
                        state : val,
                        subscribers : []
                }
            }
            this.remoteFSMMap[key].state = val
            if(this.remoteFSMMap[key].subscribers) {
                for(var subscriber of this.remoteFSMMap[key].subscribers)
                    this.stateManager.componentStateMap[subscriber].stateMachine.transition(val)
            }
        }
    }
}



export class Action {

    id : string 
    _dependents? : string[]
    type : string
    actionDispatcher : ActionDispatcher
    logger : Logger

    constructor (actionInfo : BaseAction, actionDispatcher : ActionDispatcher) {
        this.id = actionInfo.id
        this.type = actionInfo.type
        this.actionDispatcher = actionDispatcher
        this.logger = actionDispatcher.logger
    }

    get dependents () {
        if(this._dependents)
            return this._dependents
        return [] 
    }

    set dependents(value : string[]) {
        this._dependents = value
        this.log('INFO', 'created with dependents', this.dependents)
    }

    log(level : string, message : string, object : any = null) {
        switch(level) {
            case 'DEBUG' : this.logger.logDebugMessage(this.type, this.id, message, object); break;
            case 'TRACE' : this.logger.logTraceMessage(this.type, this.id, message, object); break;
            case 'INFO' : this.logger.logInfoMessage(this.type, this.id, message, object); break;
            case 'WARN' : this.logger.logWarnMessage(this.type, this.id, message, object); break;
            case 'ERROR' : this.logger.logErrorMessage(this.type, this.id, message, object); break;
            default : this.logger.logDebugMessage(this.type, this.id, message, object); break;
        }
    }

    call() {
        throw new Error("Please implement call() in child class")
    }

    cleanup() {
        this.log("DEBUG", "this component does not need cleanup")
    }

    cancel() {
        this.log("ERROR", "please implement cancel()" )
    }

    runEffects() {
        this.log("DEBUG", "this component does not have effects")
    }
} 


class HTTPRequest extends Action {

    config : AxiosRequestConfig
    aborter! : AbortController | null
    onStatus! : Stub

    constructor (actionInfo : SingleRequestConfig, actionDispatcher : ActionDispatcher){
        super(actionInfo as BaseAction, actionDispatcher)
        this.config = actionInfo.config
    }

    async call() {
        this.log("INFO", "starting request")
        let updatedRequest = this.actionDispatcher.deepUpdateDynamicValues(structuredClone(this.config))
        this.aborter = new AbortController()
        updatedRequest.signal = this.aborter.signal
        this.log('INFO', 'executing request with config', updatedRequest)
        const response = await asyncRequest(updatedRequest as AxiosRequestConfig) as AxiosResponse
        if(response.hasOwnProperty('error')) {
            // @ts-ignore
            this.log('ERROR', 'current request failed with error', response.error) 
        }
        else {
            if(response.status >= 300)
                this.log('ERROR', `request failed with response code ${response.status}. status text - ${response.statusText}. response - `, response) 
            else 
                this.log('INFO', `request return code ${response.status}. status text - ${response.statusText}. response -`, response)
            this.actionDispatcher.commitDataToState(this.id, response, this.dependents) 
        }
        this.aborter = null 
        this.log("INFO", "completed request")
    }

    cancel(): void {
        if(this.aborter) {
            this.aborter.abort()
            this.log('INFO', 'aborting because cancel() was invoked')
        }
    }
}


class QueuedHTTPRequest extends Action {

    requests : SingleRequestConfig[]
    ignoreFailedRequests : boolean
    aborter! : AbortController | null
    cancelFurtherRequests : boolean

    constructor (actionInfo : QueuedRequestConfig, actionDispatcher : ActionDispatcher){
        super(actionInfo as BaseAction, actionDispatcher)
        this.requests = actionInfo.requests
        this.ignoreFailedRequests = actionInfo.ignoreFailedRequests
        this.cancelFurtherRequests = false
    }

    async call() {
        this.cancelFurtherRequests = false
        this.log('INFO', `starting request series`)
        for (let requestData of this.requests) {
            if(this.cancelFurtherRequests)
                continue
            let updatedRequest = this.actionDispatcher.deepUpdateDynamicValues(structuredClone(requestData.config))
            this.log('INFO', 'executing request with config', updatedRequest)
            this.aborter = new AbortController()
            updatedRequest.signal = this.aborter.signal
            const response = await asyncRequest(updatedRequest as AxiosRequestConfig) as AxiosResponse
            let requestFailed = false
            if(response.hasOwnProperty('error')) {
                // @ts-ignore
                this.log('ERROR', 'current request failed with error', response.error) 
                requestFailed = true
            }
            else {
                if(response.status >= 300) {
                    this.log('ERROR', `current request failed with response code ${response.status}. status text - ${response.statusText} response -`, response) 
                    requestFailed = true
                }
                else 
                    this.log('INFO', `current request return code ${response.status}. status text - ${response.statusText}. response - `, response)
                this.actionDispatcher.commitDataToState(requestData.id, response, requestData.dependents) 
            }
            if(requestFailed && !this.ignoreFailedRequests) {
                this.log('ERROR', 'dropping request series')
                break 
            }
        }
        this.log('INFO', `request series completed`)
        this.aborter = null 
    }

    cancel(): void {
        if(this.aborter) {
            this.aborter.abort()
            this.log('INFO', 'aborting because cancel() was invoked')
        }
        this.cancelFurtherRequests = true
    }
}


class ParallelHTTPRequests extends Action {

    requests : SingleRequestConfig[] 
    aborter : AbortController[]

    constructor (actionInfo : ParallelRequestsConfig, actionDispatcher : ActionDispatcher) {
        super(actionInfo as BaseAction, actionDispatcher)
        this.requests = actionInfo.requests
        this.aborter = [] 
    }

    async call(){
        this.aborter = []
        let requests = this.requests.map((request : SingleRequestConfig, index : number) => {
            let updatedRequest = this.actionDispatcher.deepUpdateDynamicValues(structuredClone(request.config))
            this.aborter[index] = new AbortController()
            updatedRequest.signal = this.aborter[index].signal
            return axios(updatedRequest)
        })
        requests.forEach((request : AxiosPromise, index : number) => {
            request.then((response : AxiosResponse) => {
                // @ts-ignore
                this.aborter[index] = null
                if(response.config.responseType !== 'blob')
                    response.status = response.data.responseStatusCode
                if(response.status >= 300) 
                    this.log('ERROR', `current request failed with response code ${response.status}. status text - ${response.statusText} response -`, response) 
                else 
                    this.log('INFO', `current request return code ${response.status}. status text - ${response.statusText}. response - `, response)
                this.actionDispatcher.commitDataToState(this.requests[index].id, response, this.requests[index].dependents) 
            }).catch((error : any) => {
                // @ts-ignore
                this.aborter[index] = null
                this.log('ERROR', `current request with id - ${this.requests[index].id} - failed with error`, error) 
            })
        })
    }

    cancel(): void {
        for(let aborter of this.aborter) {
            try {
                if(aborter) {
                    aborter.abort()
                    this.log('INFO', 'aborting because cancel() was invoked')
                }
            } catch (error) {
                this.log('ERROR', 'could not abort a request due to error', error)
            }
        }
    }
}


class SSE extends Action {

    URL : string
    onStatus! : Stub
    source! : EventSource | null 

    constructor (actionInfo : SSEConfig, actionDispatcher : ActionDispatcher){
        super(actionInfo as BaseAction, actionDispatcher)
        this.URL = actionInfo.URL
        this.source = null 
    }

    addOnMessageCallback(source : EventSource){
        source.onmessage = (event : MessageEvent) => {
            this.log("DEBUG", "received event")
            // @ts-ignore
            this.actionDispatcher.commitDataToState(this.id, {
                        data : {returnValue : JSON.parse(event.data)}, 
                        // @ts-ignore
                        config : {url : this.URL}
                    }, this.dependents)
        }
    }

    async call() {
        let source = new EventSource(this.URL)
        this.addOnMessageCallback(source)
        source.addEventListener('close', (event : MessageEvent) => {
            this.log('INFO', 'either client or server closed the event source')
            }
        )
        source.onerror = (error) => {
            this.log('ERROR', 'received error', error)
        }
        source.onopen = (event) => {
            this.log('INFO', `connected with URL ${this.URL}`)
        }
        this.source = source 
        this.log('INFO', `registered new event source at URL : ${this.URL}`)
    }

    cancel(): void {
        if(this.source) {
            this.source.close()
            this.log('INFO', `closed event source to URL : ${this.URL}`)
        }
    }

    cleanup(): void {
        this.log('DEBUG', `Event source at URL : ${this.URL} does not need cleanup`)
    }
}


class SSEVideo extends SSE {

    addOnMessageCallback(source : EventSource){
        source.onmessage = (event : MessageEvent) => {
            this.log("DEBUG", "received event")
            // @ts-ignore
            this.actionDispatcher.commitDataToState(this.id, {
                        data : {returnValue : event.data}, 
                        // @ts-ignore
                        config : {url : this.URL}
                    }, this.dependents)
        }
    }
}


class RepeatedRequests extends Action {

    requests : SingleRequestConfig | QueuedRequestConfig | ParallelRequestsConfig
    ignoreFailedRequests? : boolean
    interval : number
    _action : HTTPRequest | QueuedHTTPRequest | ParallelHTTPRequests

    constructor (actionInfo : RepeatedRequestConfig, actionDispatcher : ActionDispatcher){
        super(actionInfo as BaseAction, actionDispatcher)
        this.requests = actionInfo.requests
        this.ignoreFailedRequests = actionInfo.ignoreFailedRequests
        this.interval = actionInfo.interval
        const [action, executable] = this.actionDispatcher.resolveAction(this.requests) 
        this._action = action as HTTPRequest | QueuedHTTPRequest | ParallelHTTPRequests
    }

    async call() {
        // debugger
        this.log("DEBUG", "starting repeated request", this.requests)
        await this._action.call()
        await sleep(this.interval)
        this.log("DEBUG", `done...calling again after ${this.interval}`)
        requestAnimationFrame(async() => await this.call())
    }

    cancel(){
        this._action.cancel()
    }

    cleanup(): void {
        this._action.cleanup()
    }

}


class ComponentOutput extends Action {

    // @ts-ignore
    call(value : any) {
        // this.actionDispatcher.updateComponentOutputMap(this.id, value, this.dependents)
        this.actionDispatcher.componentOutputMap[this.id] = value
        this.log("DEBUG", `componentOutputMap updated with value`, value)
        if(this.dependents) {
            this.actionDispatcher.stateManager.forceUpdateDependents(this.dependents)
        }
    }
}


class Cancel extends Action {

    cancelID : string

    constructor (actionInfo : CancelAction, actionDispatcher : ActionDispatcher) {
        super(actionInfo as BaseAction, actionDispatcher)
        this.cancelID = actionInfo.cancelID
    }
    
    call() {
        try {
            if(this.actionDispatcher.actions[this.cancelID] instanceof Action)
                // @ts-ignore
                this.actions[id].cancel()
        } catch(error : any) {
            this.log('ERROR', `could not cancel action due to error ${error.message}`, error)
        }
    }
}


class SetGlobalLocation extends Action {

    path : string
   
    constructor (actionInfo : SetLocationType, actionDispatcher : ActionDispatcher) {
        super(actionInfo as BaseAction, actionDispatcher)
        this.path = actionInfo.path
    }
    
    call() {
        try {
            this.actionDispatcher.hooks.setGlobalLocation!(this.path)
        } catch(error : any) {
            this.log('ERROR', `could not set location to path ${this.path}`)
        }
    }
}


class SetLocation extends Action {

    path : string

    constructor (actionInfo : SetLocationType, actionDispatcher : ActionDispatcher) {
        super(actionInfo as BaseAction, actionDispatcher)
        this.path = actionInfo.path
    }
    
    call() {
        try {
            this.actionDispatcher.hooks.setLocation!(this.path)
        } catch(error : any) {
            this.log('ERROR', `could not set (relative) location to path ${this.path}`)
        }
    }
}


class SetComponentSimpleFSMState extends Action {

    componentID : string 
    state : string

    constructor (actionInfo : SetComponentStateType, actionDispatcher : ActionDispatcher) {
        super(actionInfo as BaseAction, actionDispatcher)
        this.componentID = actionInfo.componentID
        this.state = actionInfo.state
    }
    
    call() {
        try {
            this.actionDispatcher.stateManager._componentStateMap[this.componentID].stateMachine.transition(this.state)
        } catch(error : any) {
            this.log('ERROR', `could not set state to value ${this.state}`)
        }
    }
}


class SetComponentSimpleFSMDynamicState extends Action {

    componentID : string 
    
    constructor (actionInfo : SetComponentStateType, actionDispatcher : ActionDispatcher) {
        super(actionInfo as BaseAction, actionDispatcher)
        this.componentID = actionInfo.componentID
    }
    
    // @ts-ignore
    call(value : string) {
        try {
            this.actionDispatcher.stateManager._componentStateMap[this.componentID].stateMachine.transition(value)
        } catch(error : any) {
            this.log('ERROR', `could not set state to value ${value}`)
        }
    }
}


class UnresolvedAction extends Action {

    call() {
        console.log(`resolving action info failed of type ${this.type} with id ${this.id}`)
        this.log('ERROR', `resolving action info failed of type ${this.type} with id ${this.id} & dependents ${this.dependents}`)
    }
}

