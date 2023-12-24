// Internal & 3rd party functional libraries
// Custom functional libraries
// Internal & 3rd party component libraries
// Custom component libraries

export function sleep(ms: any) : Promise<any> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function timestamp() : string {
    let currentTime =  new Date()
    let milliseconds = String(currentTime.getMilliseconds()/1000).substring(2)
    let currentTimeInString = currentTime.toLocaleTimeString().substring(0,7) + ":" + milliseconds
    return currentTimeInString
}

function getNumberStringWithWidth(num: Number, width: number) {
    let str = num.toString()
    if (width > str.length) return '0'.repeat(width - str.length) + str
    return str.substring(0, width)
}

export function getFormattedTimestamp() {
    const date = new Date()
    const h   = getNumberStringWithWidth(date.getHours(), 2)
    const min = getNumberStringWithWidth(date.getMinutes(), 2)
    const sec = getNumberStringWithWidth(date.getSeconds(), 2)
    const ms  = getNumberStringWithWidth(date.getMilliseconds(), 3)
    return `${h}:${min}:${sec}.${ms}`
}

export const downloadJSON = (response : any, filename : string) => {
    let blob = new Blob([JSON.stringify(response, null, 4)], {
        type : 'application/json'
    })
    const fileUrl = URL.createObjectURL(blob);
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = fileUrl;
    link.setAttribute('download', filename); // Specify the desired filename
    document.body.appendChild(link);
    // Simulate a click on the link to start the download
    link.click();
    // Clean up the temporary link element
    document.body.removeChild(link);
}

export const openJSONinNewTab = (obj_ : any, title : string) => {
    let tab = window.open( "data:text/json," + encodeURIComponent(obj_), '_blank') as Window
    tab.document.open();
    tab.document.write('<html><body><pre>' + JSON.stringify(obj_, null, 4) + '</pre></body></html>');
    tab.document.title = title 
    tab.document.close();
    // tab.focus(); // to finish loading the page
}

export const fetchFieldFromLocalStorage = (field : string | null, defaultValue : any = null) => {
    let obj = localStorage.getItem('daqpy-webdashboard')
    if(!obj)
        return defaultValue 
    if(typeof(obj) === 'string') 
        obj = JSON.parse(obj as string)
    if(field) {
        // @ts-ignore
        obj = obj[field]
        if(!obj)    
            return defaultValue
        return obj 
    }
    else{
        if(!obj)
            return defaultValue
        return obj   
    }
}


export const ParseJSONString = (jsonString : string) => {
    // Matt.H. https://stackoverflow.com/questions/3710204/how-to-check-if-a-string-is-a-valid-json-string
    let o = JSON.parse(jsonString);
    // Handle non-exception-throwing cases:
    // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
    // but... JSON.parse(null) returns null, and typeof null === "object", 
    // so we must check for that, too. Thankfully, null is falsey, so this suffices:
    if (o && typeof o === "object") 
        return o
    throw new Error(`given string ${jsonString.substring(0, 200)} is not a valid JSON`)
};

export const getTypedValueFromString = (value : string) => {
    return JSON.parse(value);
    // Handle non-exception-throwing cases:
    // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
    // but... JSON.parse(null) returns null, and typeof null === "object", 
    // so we must check for that, too. Thankfully, null is falsey, so this suffices:
    // if (o && typeof o === "object") 
    //     return o
    // throw new Error(`given string ${jsonString.substring(0, 200)} is not a valid JSON`)
}


export function substringFromSlashedString(inputString : string, delimiter : string, numberOfSplits : number,
        direction : string = 'END') {
    // Chat-GPT
    // Split the input string using the delimiter
    const parts = inputString.split(delimiter)
    // Check if we have enough parts to perform the specified number of splits
    if (parts.length >= numberOfSplits) {
        // Slice the array to get the end part
        const endPart = parts.slice(numberOfSplits).join(delimiter)
        return endPart
    } else 
        // If there are not enough parts, return the original string
        return inputString
}


