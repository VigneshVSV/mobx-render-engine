import { makeObservable, observable, action, computed } from 'mobx';


class AbstractFSM {

    id : string 

    constructor(id : string) {
        this.id = id
    }

    get currentStateChildren() : any[] {return []}

    get currentStateDynamicChildren() : any[] {return []}

    get currentStateProps() {return {}}

    get currentStateDynamicProps() {return {}}

}


type Action = {
    call : Function
    cleanup : Function 
    cancel : Function
    runEffects : Function
    log : Function
}


export class MobXFSM extends AbstractFSM {

    previousState : string 
    currentState  : string 
    defaultState  : string 
    states! : {
        [key : string ] : {
            props? : { [key : string] : any }
            dynamicProps? : { [key : string] : any }
            children? : Array<any>
            dynamicChildren? : Array<any>
            onEntry? : Array<Action>
            onExit?  : Array<Action>
            onExitTo? : {
                target : string
                actions : Array<Action>
            }
        }
    } 

    constructor (id : string, specifications : MachineSpec) {
        super(id)
        this.states = specifications.states
        this.currentState = specifications.defaultState 
        this.previousState = specifications.defaultState
        this.defaultState = specifications.defaultState
        makeObservable( this, {
            currentState : observable,
            currentStateChildren        : computed, 
            currentStateDynamicChildren : computed, 
            currentStateProps           : computed, 
            currentStateDynamicProps    : computed,
            transition                  : action
        })
    }

    transition(state : string | null = null) {
        throw new Error(`Implmenent transition method in class ${this.constructor.name} to make transitions`)
    }

    get currentStateChildren() : any[] {
        if(this.currentState && this.states && this.states[this.currentState] && this.states[this.currentState].children)
            return this.states[this.currentState].children as any[]
        else 
            return []
    }

    get currentStateDynamicChildren() : any[] {
        if(this.currentState && this.states && this.states[this.currentState] && this.states[this.currentState].dynamicChildren)
            return this.states[this.currentState].dynamicChildren as any[]
        else 
            return []

    }

    get currentStateProps() {
        // console.log("computing state machine props")
        if(this.currentState && this.states && this.states[this.currentState] && this.states[this.currentState].props)
            return this.states[this.currentState].props as object
        else 
            return {}
    }

    get currentStateDynamicProps() {
        if(this.currentState && this.states && this.states[this.currentState] && this.states[this.currentState].dynamicProps)
            return this.states[this.currentState].dynamicProps as object
        else 
            return {}
    }

    transitionCallback(){

        if (// make sure state changed
            this.previousState !== this.currentState && 
            // make sure previous state was not null which means do not call at init
            this.previousState &&  
            // make sure current state or previous state have callbacks
            (this.states[this.currentState] || this.states[this.previousState])
        ) {
            // first process onExit 
            if(this.states[this.previousState].onExit && this.states[this.previousState].onExit!.length > 0) {
                for(let action of this.states[this.previousState].onExit!) 
                    action.call()                
            }
            // process onExitTo
            if(this.states[this.previousState].onExitTo && (this.states[this.previousState].onExitTo!).target === this.currentState) {
                for(let action of this.states[this.previousState].onExitTo!.actions) 
                    action.call()
            }
            // then onEntry
            if(this.states[this.currentState].onEntry && this.states[this.currentState].onEntry!.length > 0) {
                for(let action of this.states[this.currentState].onEntry!) 
                    action.call()
            }
        }
    }
}
        

export type RemoteFSMMap = {
    [key : string] : {
        state : string,
        subscribers : string[]
    }
}

export class RemoteFSM extends MobXFSM {

    _stateMap! : RemoteFSMMap
    _subscribedField! : string
    
    constructor (id : string, specifications : MachineSpec){
        super(id, specifications)
        this.subscribe(specifications.subscription)
    }
    
    registerStateMap(map : RemoteFSMMap) {
        this._stateMap = map
        if(this._subscribedField) {
            this.subscribe(this._subscribedField)
        }
    }

    subscribe(subscribedField : string) {
        if(subscribedField) {
            this._subscribedField = subscribedField
            if(this._stateMap && this._stateMap[subscribedField as keyof object]) {
                if(this._stateMap[subscribedField as keyof object].state) {
                    this.currentState = this._stateMap[subscribedField as keyof object].state
                    if(!this.previousState)
                        this.previousState = this._stateMap[subscribedField as keyof object].state 
                        // during subscription current state and previous state are same 
                }
            } 
        }
    }

    transition(state : string | null = null) {
        // debugger
        if (state) {
            if(Object.keys(this.states).includes(state)) {
                this.previousState = this.currentState
                this.currentState  = state
            }
        }
        else {
            if(this._stateMap[this._subscribedField as keyof object]) {
                if(this._stateMap[this._subscribedField as keyof object].state) {
                    this.previousState = this.currentState 
                    this.currentState  = this._stateMap[this._subscribedField as keyof object].state
                }
                else 
                    return
            }
            else 
                return
        }
        // this.transitionCallback()
    }
}


export class LocalSimpleFSM extends MobXFSM {

    constructor(id : string, specifications : MachineSpec) {
        super(id, specifications)
    }

    transition(state: string | null) {
        if(state){
            if (Object.keys(this.states).includes(state)) {
                this.previousState = this.currentState
                this.currentState  = state
                // this.transitionCallback()
            } 
        }
    }
}



export type MachineSpec = {
    type : string 
    subscription : string   
    defaultState : string
    states : {
        [key : string ] : {
            props? : { [key : string] : any }
            dynamicProps? : { [key : string] : any }
            children? : Array<any>,
            dynamicChildren? : Array<any>
            onEntry? : any,
            onExit?  : any,
            onExitTo? : any,   
        }
    }
}

   
export const createStateMachine = (id : string, machineSpec : MachineSpec) : RemoteFSM | AbstractFSM 
                                                                            | null => {
    if(!machineSpec)
        return null
    switch(machineSpec.type) {
        case 'abstract' : return new AbstractFSM(id) 
        case 'RemoteFSM' : return new RemoteFSM(id, machineSpec)
        case 'SimpleFSM' : return new LocalSimpleFSM(id, machineSpec)
        // case 'XStateFSM' 
        default : throw new Error(`invalid state machine type ${machineSpec.type} for creating state machine with id ${id}`)
    }
}

