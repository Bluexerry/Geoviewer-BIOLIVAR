import React from 'react';
import { SnackbarProvider } from 'notistack';

import Snackbar from '@layout/snackbar';
import About from '@layout/about';
import Navigator from '@layout/navigator';
import Menu from '@layout/menu';
import Login from '@layout/login';
import Canvas from '@layout/canvas';
import Popup from '@layout/popup';

import StyleController from '@panels/StyleController';
import LayerController from '@panels/LayerController';
import RusleController from '@panels/RusleController';
import BushEncroacher from '@panels/BushEncroacher';
import SearchController from '@panels/SearchController';
import DataController from '@panels/DataController';
import ModelController from '@panels/ModelController';
import ImportController from '@panels/ImportController';
import VegInspectorController from '@panels/VegInspectorController';
import SpatioTemporalAnalysisController from '@panels/SpatioTemporalController';
import BandController from '@panels/BandController';
import BiodiversityController from '@panels/BiodiversityController';

import '@styles/materialize.min.style.css';

const Main = () => (
    <SnackbarProvider maxSnack={3}>
        <React.Fragment>
            <Snackbar />
            <About />
            <Navigator />
            <Menu />
            <Login />
            <BushEncroacher />
            <BandController />
            <SearchController />
            <SpatioTemporalAnalysisController />
            <BiodiversityController />
            <VegInspectorController />
            <StyleController />
            <LayerController />
            <ModelController />
            <DataController />
            <ImportController />
            <RusleController />
            <Popup />
            <Canvas />
        </React.Fragment>
    </SnackbarProvider>
);

export default Main;

