// Internal & 3rd party functional libraries
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
// Custom functional libraries
// import { RootLogger } from '../builtins/global-states';
import { JSONDeepUpdate } from './misc';
// Internal & 3rd party component libraries
// Custom component libraries


type requestType = "GET" | "POST" | "PUT" | undefined

export type baseResponseType = {
    responseStatusCode : number
}

export type pythonLoopReturnValue = {
    returnValue? : any 
    exception?   : string 
    state        : string
}

export type responseType = {
    [key : string ]    : pythonLoopReturnValue 
} & baseResponseType

export type ErrorResponse = {
    error : any
}



export async function asyncRequest(AxiosObject : AxiosRequestConfig) {          
    const response = await axios(AxiosObject).then(
        (response) => {
            if(AxiosObject.responseType !== 'blob')
                response.status = response.data.responseStatusCode
            return response
        }
    ).catch((error) => {
        return {error : error}
    })
    return response
}


export const mergeResponse = (Responses : AxiosResponse[]) : AxiosResponse => {
    var Response = {...Responses[0]}
    for(var i=1; i<Responses.length; i++) 
        JSONDeepUpdate(Response, Responses[i])
    return Response
}


export function makeFullURL(baseURL : string | undefined | null, url : string | undefined | null) : string {
    let URL = ""
    if(baseURL !== undefined && baseURL !== null)
        URL = URL.concat(baseURL)
    if(url !== undefined && url !== null)
        URL = URL.concat(url)
    return URL
    
}


