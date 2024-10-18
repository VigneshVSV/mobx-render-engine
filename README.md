# MOBX RENDER ENGINE 

A [`mobx`](https://mobx.js.org/README.html) state management based JSON driven React renderer. 
Register your custom components, use the state manager to fetch a JSON containing your components' props to make the 
renderer render your component. 

I wrote an article about this on my website [blog](https://hololinked.dev/blog/mobx-render-engine). Please have a look it.
Currently its in a dormant state and also works to some extent. But I am not developing it further. I plan to revisit it at a later time after doing a thorough analysis of existing solutions.

Currently works with `hololinked.webdashboard` python package which contains python to JSON logic and 
[`mui-mobx-render-engine`](https://github.com/VigneshVSV/MUI-mobx-react-render-engine), 
[`hololinked-dashboard-components`](https://github.com/VigneshVSV/hololinked-dashboard-components) containing some 
example components from [`React MUI`](https://mui.com/). 

Python examples at [python-examples-respository](https://github.com/VigneshVSV/mobx-render-engine-python-examples).

This is an npm distributable, not a standalone React app. 

`npm install --save @hololinked/mobx-render-engine`

For MUI components `npm install --save @hololinked/mui-render-engine`
