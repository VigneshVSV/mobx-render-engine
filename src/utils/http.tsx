// Internal & 3rd party functional libraries
import axios, { AxiosRequestConfig } from 'axios';
// Custom functional libraries
// import { RootLogger } from '../builtins/global-states';
// Internal & 3rd party component libraries
// Custom component libraries


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



export function makeFullURL(baseURL : string | undefined | null, url : string | undefined | null) : string {
    let URL = ""
    if(baseURL !== undefined && baseURL !== null)
        URL = URL.concat(baseURL)
    if(url !== undefined && url !== null)
        URL = URL.concat(url)
    return URL
    
}


