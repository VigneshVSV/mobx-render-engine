import { Logger } from "./utils/logger"

export const ACTION_RESULT = "result_of_action"
export const RAW = "raw"
export const NESTED = "nested"
export const ACTION = "action"

const addop = "+" 
const subop = "-"
const mulop = "*"
const divop = "/"
const floordivop = "//"
const modop = "%"
const powop = "^"
const gtop  = ">"
const geop  = ">="
const ltop  = "<"
const leop  = "<="
const eqop  = "=="
const neop  = "!="

const orop  = "or"
const andop = "and"
const xorop = "xor"
const notop = "not"


export type Stub = {
    op1      : string | Stub | number | boolean
    op1dtype  : string 
    op1interpretation : string,
    op2?      : string | Stub | number | boolean
    op2dtype?  : string
    op2interpretation? : string, 
    op?      : string
    func?    : string 
    prop?    : string       
    args?    : any[]
    fields?  : string
}

export type ComponentOutputMap = {
    [key : string] : any 
}

export type ActionsMap = {
    [key : string] : any
}

export type ActionInfo = {
    type : string 
    id : string
    dependents? : string[]
    [key : string] : any
}

export class StubEvaluator {

    id : string 
    logger : Logger 
    componentOutputMap : ComponentOutputMap
    actionStubsMap : ActionsMap
    actionDispatcher : any 

    constructor(id : string, logger : Logger, componentOutputMap : ComponentOutputMap, actionDispatcher : any) {
        this.id = id 
        this.logger = logger 
        this.componentOutputMap = componentOutputMap
        this.actionStubsMap = {}
        this.actionDispatcher = actionDispatcher
    }
    
    generateValue(op : string, value : Stub) : any {
        // console.log("stub", value)
        if (value[op+"interpretation" as keyof Stub] === ACTION_RESULT) {
            let finalValue = this.componentOutputMap[value[op as keyof Stub] as string]
            // console.log("final value", finalValue)
            if (finalValue === undefined){
                switch(value[op+"dtype" as keyof Stub]){
                    case 'number' : return 0
                    case 'string' : return ''
                    case 'boolean': return true
                    case 'object'   : return undefined
                    default : this.logger.logErrorMessage("StubEvaluator.generateValue", this.id,
                                            `unknown ${op}dtype : ${value[op+"dtype" as keyof Stub]}`)
                }
            }
            switch(value[op+"dtype" as keyof Stub]){
                case 'object' :
                            if (value.fields) {
                                let fields = value.fields.split('.')
                                for (let field of fields) {
                                    if (finalValue[field])
                                        finalValue = finalValue[field]
                                    else {
                                        this.logger.logErrorMessage("StubEvaluator.generateValue", this.id, 
                                            `field ${field} not found in object ${finalValue} of ${value[op as keyof Stub]}`)
                                        return undefined
                                    }
                                }
                            };
                            break;
                
                default : break
            }
            return finalValue
        }
        else if (value[op+"interpretation" as keyof Stub] === ACTION) {
            let finalValue = this.actionStubsMap[value[op as keyof Stub] as string]
            return this.actionDispatcher.createNew(finalValue)
        }
        else if (value[op+"interpretation" as keyof Stub] === RAW) 
            return value[op as keyof Stub] as string | number | boolean
        else
            this.logger.logErrorMessage("StubEvaluator.generateValue", this.id, 
                                `unknown op interpretation found - ${value[op+"interpretation" as keyof Stub]}`)
    }

    resolveStubInfo(stub : Stub) : any {
        // debugger
        // single operand 
        if (!stub.hasOwnProperty('op2'))
            return this.generateValue('op1', stub)
        
        // nested ops
        if (stub.op1interpretation === NESTED)
            stub.op1 = this.resolveStubInfo(stub.op1 as Stub)
        if (stub.op2interpretation === NESTED)
            stub.op2 = this.resolveStubInfo(stub.op2 as Stub)
    
        // two operands
        switch(stub.op1dtype) {
            case 'number'  : return this.NumberOperation (stub)
            case 'boolean' : return this.BooleanOperation(stub)
            case 'string'  : return this.StringOperation (stub)    
            default        : this.logger.logErrorMessage("StubEvaluator.resolveStubInfo", this.id, 
                                                    `operation type unknown for op1 (op1dtype) - ${stub}`)
        }
    }

    NumberOperation(stub : Stub) : number | boolean {
    
        switch(stub.op) {
            case addop : return this.generateValue("op1", stub) + this.generateValue("op2", stub) 
            case subop : return this.generateValue("op1", stub) - this.generateValue("op2", stub) 
            case mulop : return this.generateValue("op1", stub) * this.generateValue("op2", stub)
            case divop : return this.generateValue("op1", stub) / this.generateValue("op2", stub)
            case floordivop : return Math.floor(this.generateValue("op1", stub) / this.generateValue("op2", stub)) 
            case modop : return this.generateValue("op1", stub) %   this.generateValue("op2", stub) 
            case powop : return this.generateValue("op1", stub) ^   this.generateValue("op2", stub)  
            case gtop  : return this.generateValue("op1", stub) >   this.generateValue("op2", stub)
            case geop  : return this.generateValue("op1", stub) >=  this.generateValue("op2", stub)
            case ltop  : return this.generateValue("op1", stub) <   this.generateValue("op2", stub)
            case leop  : return this.generateValue("op1", stub) <=  this.generateValue("op2", stub)
            case eqop  : return this.generateValue("op1", stub) === this.generateValue("op2", stub)
            case neop  : return this.generateValue("op1", stub) !== this.generateValue("op2", stub)
            default    : this.logger.logErrorMessage("StubEvaluator", "NumberOperation", 
                                                    `number operation type unknown ${stub.op} - stub : ${stub}`)
        }
        return 0
    }

    BooleanOperation(stub : Stub) : boolean {
        switch(stub.op) {
            case orop  : return this.generateValue("op1", stub) || this.generateValue("op1", stub)
            case andop : return this.generateValue("op1", stub) && this.generateValue("op1", stub) 
            case xorop : return this.generateValue("op1", stub)? !this.generateValue("op1", stub) : this.generateValue("op2", stub)
            case notop : return !this.generateValue("op1", stub)  
            default    : this.logger.logErrorMessage("StubEvaluator", "BooleanOperation", 
                                    `calculateEffectiveValue boolean operation type unknown - ${stub.op}`)
        }
        return true
    }

    StringOperation(stub : Stub) : number | boolean | string {
        switch(stub.op) {
            case addop     : return this.generateValue("op1", stub) + this.generateValue("op2", stub)
        }
        
        switch(stub.prop) {
            case "length"   : return this.generateValue("op1", stub).length
        }
    
        switch(stub.func) {
            case "slice"     : return this.generateValue("op1", stub).slice(...stub.args as any[])
            case "substring" : return this.generateValue("op1", stub).substring(...stub.args as any[])
            case "substr"    : return this.generateValue("op1", stub).substr(...stub.args as any[])
            default          : this.logger.logErrorMessage("StubEvaluator", "StringOperation", 
                                            `calculateEffectiveValue string operation type unknown - ${stub.op}`)
        }
    
        return ""
    }
    
}








 

