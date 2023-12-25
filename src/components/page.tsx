// Internal & 3rd party functional libraries
import React from 'react';
import { observer } from 'mobx-react-lite';
// custom functional libraries
// MUI component libraries
//custom component libraries
import { RenderEngineComponentProps } from '../index';



export const ContextfulPage = observer(({ state, renderer, logger } : RenderEngineComponentProps  ) => {
    
    const id = state.id
    logger.logMounting('ContextfulPage', id)

    return (
            <div id={id}>    
                {renderer.Children(state.computedChildren)}
            </div>
        )
    }
)

