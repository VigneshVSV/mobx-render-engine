import { AxiosRequestConfig, AxiosResponse } from 'axios';
import log from 'loglevel';
import { makeFullURL, asyncRequest } from './http';
import { Method } from 'axios';
import { timestamp, sleep } from './misc';

export type loglevels = "INFO" | "TRACE" | "DEBUG" | "ERROR" | "WARN"

export class Logger {

    id     : string
    logger : log.Logger
    url    : string
    method : Method
    // debugLogs : any[][] 	
    // traceLogs : any[][] 
    // warnLogs  : any[][] 
    // errorLogs : any[][] 	
    // infoLogs  : any[][] 
    logs : any[][]

    constructor(name : string = 'root', level : loglevels = "INFO", serverEndpoint : string = '', method : Method = 'post') {
        this.id = name
        this.logger = Logger.getLogger(name, level) 
        this.url = serverEndpoint
        this.method = method
        this.logs = []
    }

    static getLogger(name : string, level : loglevels = "INFO") : log.Logger {
        var logger = log.getLogger(name)
        logger.setLevel(level)
        return logger
    }

    // async syncServer() {
    //     if(this.url !== '') {
    //         if(this.debugLogs.length + this.traceLogs.length + this.warnLogs.length + this.errorLogs.length + this.infoLogs.length > 1000) {
    //             this.logWarnMessage("logger", "RootLogger", "syncing to server has not been implemented yet")
    //             // await asyncRequest({
    //             //     url    : this.url,
    //             //     method : this.method,
    //             //     data : {
    //             //         debug : this.debugLogs,
    //             //         trace : this.traceLogs,
    //             //         warn  : this.warnLogs,
    //             //         error : this.errorLogs,
    //             //         info  : this.infoLogs
    //             //     }}, 'logger', true)
    //             //     // just check for logs every ten seconds and write to server
    //             //     this.debugLogs.length = 0
    //             //     this.traceLogs.length = 0
    //             //     this.warnLogs.length  = 0
    //             //     this.errorLogs.length = 0 
    //             //     this.infoLogs.length  = 0
    //             }
    //         await sleep(10*60000) 
    //         requestAnimationFrame(this.syncServer)
    //     }
    // }

    logDebugMessage(component_or_module : string, compid_or_func : string, message : string, object : any = null) : void  {        
        const tstamp = timestamp()
        this.logs.unshift([tstamp, "DEBUG", component_or_module, compid_or_func, message, object])
        this.logger.debug("%c%s %s %s %s : %s %o" , "color : green; font-weight:bold;", "[DEBUG]", tstamp, 
                                                                    component_or_module, compid_or_func, message, object)
    }

    logErrorMessage(component_or_module : string, compid_or_func : string, message : string, object : any = null) : void  {
        const tstamp = timestamp()
        this.logs.unshift([tstamp, "ERROR", component_or_module, compid_or_func, message, object])
        this.logger.error("%c%s %s %s %s : %s %o" , "color : red; font-weight:bold;"  , "[ERROR]", tstamp, 
                                                                    component_or_module, compid_or_func, message, object)
    }

    logTraceMessage(component_or_module : string, compid_or_func : string, message : string, object : any = null) : void  {        
        const tstamp = timestamp()
        this.logs.unshift([tstamp, "TRACE", component_or_module, compid_or_func, message, object])
        this.logger.trace("%c%s %s %s %s : %s %o" , "color : green; font-weight:bold;", "[TRACE]", tstamp, 
                                                                    component_or_module, compid_or_func, message, object)
    }

    logWarnMessage(component_or_module : string, compid_or_func : string, message : string, object : any = null) : void  {        
        const tstamp = timestamp()
        this.logs.unshift([tstamp, "WARN", component_or_module, compid_or_func, message, object])
        this.logger.warn("%c%s %s %s %s : %s %o" , "color : yellow; font-weight:bold;", "[WARN]", tstamp, 
                                                                    component_or_module, compid_or_func, message, object)
    }

    logInfoMessage(component_or_module : string, compid_or_func : string, message : string, object : any = null) : void  {        
        const tstamp = timestamp()
        this.logs.unshift([tstamp, "INFO", component_or_module, compid_or_func, message, object])
        this.logger.info("%c%s %s %s %s : %s %o" , "color : yellow; font-weight:bold;", "[INFO]", tstamp, 
                                                                    component_or_module, compid_or_func, message, object)
    }

    logMounting(component_or_module : string, compid_or_func : string) : void {
        const tstamp = timestamp()
        const message = `mounting ${component_or_module} with id ${compid_or_func}`
        this.logs.unshift([tstamp, "DEBUG", component_or_module, compid_or_func, message, null])
        this.logger.trace("%c%s %s : %s" , "color : green; font-weight:bold;", "[DEBUG]", tstamp, message)
    }

    logStateMap(component : string, id : string, message : string, stateMap : object) {
        this.logger.debug("%c%s %s %s %s : %o" , "color : red; font-weight:bold;", "[DEBUG]", component, id, message, stateMap)
    }
    
    logData(component : string, id : string, message : string, data : object) {
        this.logger.debug("%c%s %s %s %s : %o" , "color : yellow; font-weight:bold;", "[DEBUG]", component, id, message, data)
    }

    logComponentsList(component : string, id : string, message : string, list : string[]) {
        this.logger.debug("%c%s %s %s %s : %o" , "color : brown; font-weight:bold;", "[DEBUG]", component, id, message, list)
    }

    drawLine() {
        console.debug("%c%s", "color : orange;","---------------------------------------------------------------------------------")
    }
    
    clearLogs() {
        this.logs.length = 0
        this.logs = new Array(5000)
    }
    
    get sortedLogs() {
        let logs = []
        let count = 0
        console.log("calling sorted logs", this.logs)
        for(let log of this.logs) {
            logs.push({
                id : count,
                timestamp : log[0],
                level : log[1],
                componentType : log[2],
                componentID : log[3],
                message : {
                    str : log[4],
                    obj : log[5]
                }
            })
            count += 1
            if(count > 1000)
                break
        }
        return logs
    }
}



