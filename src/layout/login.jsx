import React from 'react';

import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import CircularProgress from '@material-ui/core/CircularProgress';
import Dialog from '@material-ui/core/Dialog';
import Slide from '@material-ui/core/Slide';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import indigo from '@material-ui/core/colors/indigo';
import { MuiThemeProvider, createTheme } from '@material-ui/core/styles';
import Autocomplete from '@material-ui/lab/Autocomplete';
import emitter from '@utils/events.utils';
import authService from '@services/auth.service';

const theme = createTheme({
    palette: {
        primary: {
            main: indigo.A200
        }
    }
});

const catastralList = ["41046A010000100000DU","41041A014001860000HF","41041A014001790000HQ", "41041A015002920000HF", "41041A015002760000HH", "41041A015002730000HS", "41041A014000920000HF", "41041A007003790000HK", "41041A005000430000HO"];


const styles = {
    loginContainer: {
        width: 300,
        height: 350,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
    },
    title: {
        marginBottom: 20
    },
    inputBox: {
        width: 240,
        marginTop: 15
    },
    autocomplete: {
        width: 240,       
        display: 'flex',
        flexWrap: 'wrap',
        overflow: 'auto',
    },
    checkBox: {
        width: 140
    },
    loginBtnContainer: {
        display: 'inline-block',
        position: 'relative'
    },
    loginBtn: {
        width: 120,
        marginTop: 20
    },
    loginBtnProgress: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -3,
        marginLeft: -12,
    }
};



const Transition = React.forwardRef((props, ref) => {
    return <Slide direction="down" ref={ref} {...props} />;
});

class Login extends React.Component {
    state = {
        open: false,
        logining: false,
        mode: 'login',
        selectedOptions:[],
        datasets:{}
    }

    handleLoginClose = () => {
        this.setState({
            open: false
        });
    }

    handleChangeForm = () => {
        this.setState(prev => ({
            mode: prev.mode === 'login' ? 'register' : 'login'
        }));
    }

    handleChangeAutoComplete = (e, newValue) => {
        const updatedReferences = newValue.map(option => option.reference);
        this.setState({ selectedOptions: updatedReferences });
    };

    getUserParcels = async (userId) => {
        try {
            const parcels = await authService.getUserParcels(userId);
            this.updateDatasetUtilsFile(parcels);
        } catch (error) {
            emitter.emit('showSnackbar', 'error', 'Error al obtener las parcelas.');
        }
    }

    updateDatasetUtilsFile(parcels) {
        const datasets = {};
        parcels.forEach(parcel => {
            datasets[parcel.catastral_ref] = { data: parcel.geojson_data };
        });
        this.setState({ datasets });
        emitter.emit('moveDataset', datasets);
    }    

    handleLoginClick = async () => {
        this.setState({ logining: true });
        try {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            const { userId, token } = await authService.login(username, password);

            localStorage.removeItem('token');
            localStorage.removeItem('jwt');
            localStorage.setItem('token', token);

            emitter.emit('handleToken', token);
            emitter.emit('showSnackbar', 'success', 'User login successfully.');
            emitter.emit('setLoginState', true);

            this.getUserParcels(userId);

            this.setState({ open: false, logining: false, idUser: userId });
        } catch {
            emitter.emit('showSnackbar', 'error', 'Error al iniciar sesión.');
            this.setState({ logining: false });
        }
    }


    moveDataset = () => {
        const datos = this.state.datasets;
        this.setState({ movedData: datos });
    }

    componentDidMount() {
        this._handleLogin = () => this.setState({ open: true });
        this._handleMoveDataset = () => this.moveDataset();
        emitter.addListener('login', this._handleLogin);
        emitter.addListener('moveDataset', this._handleMoveDataset);
    }

    componentWillUnmount() {
        emitter.removeListener('login', this._handleLogin);
        emitter.removeListener('moveDataset', this._handleMoveDataset);
    }

    render() {
        return (
            <MuiThemeProvider theme={theme}>
                <Dialog open={this.state.open} TransitionComponent={Transition} onClose={this.handleLoginClose}>
                    <div style={styles.loginContainer}>
                        {this.state.mode === 'login' ?                         
                        <><Typography style={styles.title} variant="h5" gutterBottom>Inicio de Sesión</Typography><TextField
                                style={styles.inputBox}
                                variant="outlined"
                                margin="dense"
                                id="username"
                                label="Usuario" /><TextField
                                    style={styles.inputBox}
                                    variant="outlined"
                                    margin="dense"
                                    id="password"
                                    type="password"
                                    label="Contraseña" /></>
 :                       <><Typography style={styles.title} variant="h5" gutterBottom>Registro</Typography>
                            <TextField
                                style={styles.inputBox}
                                variant="outlined"
                                margin="dense"
                                id="username"
                                label="Usuario" />
                            <TextField
                                style={styles.inputBox}
                                variant="outlined"
                                margin="dense"
                                id="password"
                                type="password"
                                label="Contraseña" />

                            <Autocomplete
                            style={styles.inputBox}
                            multiple
                            onChange={this.handleChangeAutoComplete}
                            limitTags={1}
                            id="checkboxes-tags-demo"
                            options={catastralList}
                            getOptionLabel={(option) => option}
                            renderOption={(option, { selected }) => (
                                <React.Fragment>
                                <Checkbox
                                    style={{ marginRight: 1, marginLeft:1 }}
                                    checked={selected}
                                />
                                {option}
                                </React.Fragment>
                            )}
                            renderInput={(params) => (
                                <TextField id="lista" {...params} variant="outlined" label="Checkboxes" placeholder="Favorites" />
                            )}

                            renderTags={() => null} // No renderizar tags en el TextField

                            />
                             </>
}

                        <div style={styles.loginBtnContainer}>
                            <Button style={styles.loginBtn} variant="contained" color="primary" disabled={this.state.logining} onClick={this.handleLoginClick}>INICIAR SESIÓN</Button>
                            {this.state.logining && <CircularProgress style={styles.loginBtnProgress} size={24} />}
                            <Button style={styles.loginBtn} onClick={this.handleChangeForm} color="primary">
                            {this.state.mode === 'login' ? 'Register' : 'Login'}
                        </Button>
                        </div>
                    </div>
                </Dialog>
            </MuiThemeProvider>
        );
    }
}

export default Login;
