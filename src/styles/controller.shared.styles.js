/**
 * Shared controller styles — used across all side-panel controllers.
 * Each feature imports this and only defines its unique overrides.
 */

export const controllerRoot = {
    position: 'fixed',
    top: 74,
    right: 10,
    borderRadius: 1,
    minWidth: 350,
    margin: 0,
    zIndex: 900,
    boxShadow: '-6px 6px 15px rgba(0, 0, 0, 0.15)',
};

export const controllerHeader = {
    // Override backgroundColor in each feature
};

export const controllerCloseBtn = {
    position: 'absolute',
    top: 6,
    right: 8,
    fontSize: 22,
};

export const controllerContent = {
    paddingBottom: 16,
};

export const controllerSearchField = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: 40,
    padding: '2px 4px',
};

export const controllerSearchBox = {
    marginLeft: 8,
    flex: 1,
    border: 'none',
};

export const controllerResultTable = {
    boxShadow: 'none',
};

export const controllerSaveBtn = {
    display: 'inline-block',
    position: 'relative',
    marginRight: 10,
};

export const controllerSaveBtnProgress = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -12,
    marginLeft: -12,
};

export const controllerLocationImage = {
    display: 'block',
    marginTop: 5,
    width: 225,
    height: 140,
    borderRadius: 3,
    cursor: 'pointer',
};

export const controllerPreviewImageContainer = {
    display: 'flex',
    alignItems: 'center',
};
