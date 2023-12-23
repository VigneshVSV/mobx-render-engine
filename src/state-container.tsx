// Internal & 3rd party functional libraries
import { makeObservable, observable, action, computed, override } from 'mobx';
// custom functional libraries
import { Stub } from './stub-evaluator';
import { createStateMachine, MachineSpec, RemoteFSM } from './state-machine';
// Internal & 3rd party component libraries
// Custom component libraries


export type GenericComponentProps = {
    [key : string] : any
}

export type ComponentData = {
    id              : string
    tree            : string
    componentName   : string
    props           : { [key : string] : any }
    dynamicProps    : { [key : string] : Stub }
    dependentsExist : boolean
    dependents      : string[]
    stateMachine    : null | MachineSpec
    children        : any[]
    dynamicChildren : Stub[]
    metadata?       : {
        RGLDataGrid? : object
        styling?  : object
        [key : string] : any
    } | null
}

export type PlotlyComponentData = ComponentData & {
    plot : string
    sources : {
        [key : string] : Stub
    }
}

export type VideoComponentData = ComponentData & {
    img : string | null
    boxProps : { [key : string] : any}
    sources : any
}



export class ComponentState {

    id!              : string
    tree!            : string
    componentName!   : string   
    props!           : GenericComponentProps
    dynamicProps!    : { [key : string] : Stub }
    dependentsExist! : boolean
    dependents!      : string[]
    stateMachine!    : RemoteFSM
    children!        : any[] | null
    dynamicChildren! : Stub[] | null
    resolveStubInfo  : (stub : Stub) => string | number | undefined | null | boolean
    metadata!        : {
                RGLDataGrid? : object
                styling?  : object 
                [key : string] : any
            } 
   

    constructor(componentData : ComponentData, stubResolver : any) {

        makeObservable(this, {           
            props               : observable,
            dynamicProps        : observable,
            children            : observable,
            dynamicChildren     : observable,
            metadata            : observable,
            computedProps       : computed,
            computedChildren    : computed, // allows re-rendering of children separately
            updateComponentData : action,
            forceUpdate         : action,
            setRGLDataGrid         : action
            // something missing?
        })
        this.metadata = {}
        this.children = null
        this.dynamicChildren = null
        this.resolveStubInfo = stubResolver
        if (!componentData.id)
            throw new Error("component id cannot be null - received component data with null id")
        else 
            this.setComponentData(componentData)
    }

    
    get computedProps() : GenericComponentProps {
        // console.log("computing ", this.id, " props")
        let tempProps : { [key : string] : any }, tempDynamicProps : { [key : string] : Stub } 
        if(this.stateMachine) {
            tempProps = {
                ...this.props,
                ...this.stateMachine.currentStateProps
            }
            tempDynamicProps = {
                ...this.dynamicProps,
                ...this.stateMachine.currentStateDynamicProps
            }
        }
        else {
            tempProps = {...this.props}
            tempDynamicProps = {...this.dynamicProps}
        }
        for(let key of Object.keys(tempDynamicProps)) {       
            tempProps[key] = this.resolveStubInfo(tempDynamicProps[key])
        }   
        return tempProps
    }


    get computedChildren() : string[] {
        let tempChildren : any[] = [], tempDynamicChildren : Stub[] = []
        if(this.stateMachine) {
            tempChildren.push(...this.stateMachine.currentStateChildren)
            if(tempChildren.length === 0 && this.children)
                tempChildren.push(...this.children)
            tempDynamicChildren.push(...this.stateMachine.currentStateDynamicChildren)
            if(tempDynamicChildren.length === 0 && this.dynamicChildren)
                tempDynamicChildren.push(...this.dynamicChildren)
        }
        else {
            if(this.children)
                tempChildren.push(...this.children)
            if(this.dynamicChildren)
                tempDynamicChildren.push(...this.dynamicChildren)
        }
        for(let object of tempDynamicChildren) {       
            tempChildren.push(this.resolveStubInfo(object))
        } 
        // console.log("computed children for ", this.id, tempChildren)
        return tempChildren
    }


    setComponentData(componentData : ComponentData) {
        if(componentData.id)            
            this.id = componentData.id
        if(componentData.tree)          
            this.tree = componentData.tree
        if(componentData.componentName) 
            this.componentName = componentData.componentName
        if(componentData.props) {
            if(this.props)
                this.props = {...this.props, ...componentData.props}
            else 
                // @ts-ignore - some incompatible need to check
                this.props = {...componentData.props} 
        }     
        if(componentData.dynamicProps) {
            if(this.dynamicProps) 
                this.dynamicProps = {...this.dynamicProps, ...componentData.dynamicProps}
            else 
                this.dynamicProps = {...componentData.dynamicProps}
        }
        if(componentData.dependentsExist)
            this.dependentsExist = componentData.dependentsExist
        if(componentData.dependents)
            this.dependents = componentData.dependents
        if(componentData.children) 
            this.children = componentData.children
        if(componentData.dynamicChildren) 
            this.dynamicChildren = componentData.dynamicChildren
        if(componentData.stateMachine) {
            // debugger
            this.stateMachine = createStateMachine(this.id, componentData.stateMachine) as RemoteFSM
        }
        if(componentData.metadata) {   
            for (let key of Object.keys(componentData.metadata)) {
                if (componentData.metadata[key]) {
                    if(this.metadata[key])
                        this.metadata[key] = {...this.metadata[key], ...componentData.metadata[key]}
                    else 
                        this.metadata[key] = {...componentData.metadata[key]}
                }
            }
        }
    }

    updateComponentData (componentData : ComponentData) {
        this.setComponentData(componentData)
    }

    forceUpdate () : void {
        this.props = {...this.props}
        if(this.children)
            this.children = [...this.children]
        else if(this.dynamicChildren)
            this.children = [...this.dynamicChildren]
    }
    
    setRGLDataGrid(RGLDataGrid : any) : void {
        this.metadata.RGLDataGrid = RGLDataGrid
        // console.log("new metadata", this.metadata)
        this.metadata = {...this.metadata}
    }
 
    addDependent(dependent : string) : void {        
        if(!this.dependents.includes(dependent))  
            this.dependents.push(dependent)
        if(this.dependents.length > 0) 
            this.dependentsExist = true  
    }

}


export class PageState extends ComponentState {

    componentStateMap : any 

    constructor(componentData : ComponentData, stubResolver : any, componentStateMap : any) {
        super(componentData, stubResolver)  
        makeObservable(this, {                      
            setGridEditable : action,
            setGridStatic : action
            // something missing?
        })
        this.componentStateMap = componentStateMap
    }

    // does not work - https://github.com/react-grid-layout/react-grid-layout/issues/1095
    // its not that easy to edit the layout by changing values, therefore we will instead give the option of downloading a layout and setting it back through python
    setGridEditable() {
        if(this.children) {
            let grid = this.componentStateMap[this.children[0]]
            for (let gridChildren of grid.children) {
                this.componentStateMap[gridChildren].setRGLDataGrid({...this.componentStateMap[gridChildren].metadata.RGLDataGrid, isDraggable : true, isResizable : true})
                this.componentStateMap[gridChildren].forceUpdate()      
            } 
            this.forceUpdate()
        }
    }

    setGridStatic() {
        if(this.children) {
            let grid = this.componentStateMap[this.children[0]]
            for (let gridChildren of grid.children) {
                this.componentStateMap[gridChildren].setRGLDataGrid({...this.componentStateMap[gridChildren].metadata.RGLDataGrid, isDraggable : false, isResizable : false})
                this.componentStateMap[gridChildren].forceUpdate()
            } 
            this.forceUpdate()
        }
    }
}


export class PlotlyState extends ComponentState {

    plot! : {
        layout?   : any
        data?     : any
        frames?   : any
        config?   : any
        style?    : any
    }
    sources!  : { [key : string ] : Stub } | null
    revision! : number

    constructor(componentData : PlotlyComponentData, stubResolver : any) {
        // set componentData is called 
        super(componentData, stubResolver)
        
        makeObservable(this, {           
            revision             : observable,
            updateComponentData  : override,
            computedPlot         : computed,
            forceUpdate          : override
            // something missing?
        })
        this.revision = 0
        this.setComponentData(componentData)
    }
    
    setComponentData(componentData: PlotlyComponentData): void {
        super.setComponentData(componentData)
        if (componentData.plot) {
            if(!this.plot)
                this.plot = {
                    data : null,
                    layout : null,
                    frames : null, 
                    config : null, 
                    style  : null
                }
            let plot = JSON.parse(componentData.plot)
            if (plot.data) 
                this.plot.data = plot.data 
            if (plot.layout)
                this.plot.layout = plot.layout
            if (plot.frames)
                this.plot.frames = plot.frames 
            if (plot.config)
                this.plot.config = plot.config 
            if (plot.style)
                this.plot.style = plot.style 
            }
        if(componentData.sources) 
            this.sources = componentData.sources
    }

    updateComponentData(componentData: PlotlyComponentData): void {
        super.setComponentData(componentData)
        this.revision = this.revision + 1
    }

    forceUpdate (): void {
        // debugger
        if(this.sources && this.plot){
            for(let field of Object.keys(this.sources)){
                // @ts-ignore
                let value = this.resolveStubInfo(this.sources[field])
                // console.log('resolved stub info', field, value)
                if(value) {
                    let nested_fields = field.split('.')
                    let nested_plot_data = this.plot 
                    for(let i = 0; i < nested_fields.length; i++){
                        try{
                            let nested_field = nested_fields[i]
                            if(i === nested_fields.length - 1)
                                // @ts-ignore 
                                nested_plot_data[nested_field] = value
                            else if(nested_field.endsWith(']')) {
                                let field_with_index = nested_field.split('[', 2)
                                let field_name = field_with_index[0]
                                let index = Number(field_with_index[1].split(']')[0])
                                // @ts-ignore
                                nested_plot_data = nested_plot_data[field_name][index]
                            } 
                            else 
                                // @ts-ignore
                                nested_plot_data = nested_plot_data[nested_field]
                        } catch(error) {
                            // We catch error due to wrong indexing and field accessing. Errors with stub resolving
                            // are taken care at stub level
                            // We also update as many fields as possible, if not all succeed
                            console.log(error) // needs to be fixed
                        }
                    }   
                }
            }
            this.revision = this.revision + 1
            // console.log("revision", this.revision)
        }
    }

    get computedPlot() {
        // console.log('updating plot')
        return this.plot
    }
}


export class VideoComponentState extends ComponentState {

    img! : string | null
    boxProps! : { [key : string] : any}
    sources! : Stub 

    constructor(componentData : VideoComponentData, stubResolver : any) {
        // set componentData is called 
        super(componentData, stubResolver)
        
        makeObservable(this, {           
            img      : observable,
            boxProps : observable,
            setImage : action, 
            forceUpdate : override,
            computedImg : computed         
            // something missing?
        })
        this.img = null
        this.boxProps = componentData.boxProps 
        this.setComponentData(componentData)
    }
    
    setComponentData(componentData : VideoComponentData): void {
        super.setComponentData(componentData)
        if(componentData.sources) 
            this.sources = componentData.sources
       
    }

    setImage(image : string) {
        this.img = 'data:image/jpeg;base64,' + image
    }
    
    forceUpdate() {
        this.img = 'data:image/jpeg;base64,' + this.resolveStubInfo(this.sources)
        console.log("force updated")        
    }

    get computedImg() {
        console.log("reading image")
        return {
            img : this.img,
            boxProps : this.boxProps
        }
    }
}

export type ComponentStateMap = {
    [key : string] : ComponentState //| HttpButtonState | ReactResponsiveGridState 
}
