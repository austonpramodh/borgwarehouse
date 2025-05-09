import { IconExternalLink, IconTrash } from '@tabler/icons-react';
import { fromUnixTime } from 'date-fns';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast, ToastOptions } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useFormStatus } from '~/hooks';
import { IntegrationTokenType, Optional, TokenPermissionEnum, TokenPermissionsType } from '~/types';
import classes from '../UserSettings.module.css';

//Components
import CopyButton from '~/Components/UI/CopyButton/CopyButton';
import Error from '~/Components/UI/Error/Error';
import Info from '~/Components/UI/Info/Info';
import { useLoader } from '~/contexts/LoaderContext';

type IntegrationsDataForm = {
  tokenName: string;
};

export default function Integrations() {
  const toastOptions: ToastOptions = {
    position: 'top-right',
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<IntegrationsDataForm>({ mode: 'onChange' });
  const { start, stop } = useLoader();

  const { error, handleError, clearError, setIsLoading, isLoading } = useFormStatus();

  const renderPermissionBadges = (permissions: TokenPermissionsType) => {
    return Object.entries(permissions)
      .filter(([, hasPermission]) => hasPermission)
      .map(([key]) => (
        <div key={key} className={classes.permissionBadge}>
          {key.charAt(0).toUpperCase() + key.slice(1)}
        </div>
      ));
  };

  ////State
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [tokenList, setTokenList] = useState<Array<IntegrationTokenType>>();
  const [lastGeneratedToken, setLastGeneratedToken] =
    useState<Optional<{ name: string; value: string }>>();
  const [deletingToken, setDeletingToken] = useState<Optional<IntegrationTokenType>>(undefined);
  const [permissions, setPermissions] = useState<TokenPermissionsType>({
    create: false,
    read: false,
    update: false,
    delete: false,
  });

  const fetchTokenList = async () => {
    start();
    try {
      const response = await fetch('/api/v1/integration/token-manager', {
        method: 'GET',
        headers: {
          'Content-type': 'application/json',
        },
      });
      const data: Array<IntegrationTokenType> = await response.json();
      setTokenList(data);
    } catch (error) {
      handleError('Fetching token list failed.');
    } finally {
      stop();
    }
  };

  ////LifeCycle
  useEffect(() => {
    fetchTokenList();
  }, []);

  // Permissions handler
  const hasNoPermissionSelected = () => {
    return !Object.values(permissions).some((value) => value);
  };
  const togglePermission = (permissionType: TokenPermissionEnum) => {
    const updatedPermissions = {
      ...permissions,
      [permissionType]: !permissions[permissionType],
    };
    setPermissions(updatedPermissions);
  };
  const resetPermissions = () => {
    setPermissions({
      create: false,
      read: false,
      update: false,
      delete: false,
    });
  };

  //Form submit handler to ADD a new token
  const formSubmitHandler = async (data: IntegrationsDataForm) => {
    start();
    clearError();
    setIsLoading(true);

    // Post API to send the new token integration
    try {
      const response = await fetch('/api/v1/integration/token-manager', {
        method: 'POST',
        headers: {
          'Content-type': 'application/json',
        },
        body: JSON.stringify({
          name: data.tokenName,
          permissions: permissions,
        }),
      });
      const result = await response.json();
      setLastGeneratedToken({ name: data.tokenName, value: result.token });

      if (!response.ok) {
        toast.error(result.message, toastOptions);
      } else {
        fetchTokenList();
        toast.success('🔑 Token generated !', toastOptions);
      }
    } catch (error) {
      toast.error('Failed to generate a new token', toastOptions);
    } finally {
      setIsLoading(false);
      resetPermissions();
      reset();
      stop();
    }
  };

  //Delete token
  const deleteTokenHandler = async (tokenName: string) => {
    setIsDeleteLoading(true);
    try {
      const response = await fetch('/api/v1/integration/token-manager', {
        method: 'DELETE',
        headers: {
          'Content-type': 'application/json',
        },
        body: JSON.stringify({
          name: tokenName,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        toast.error(result.message, toastOptions);
        setIsDeleteLoading(false);
      } else {
        fetchTokenList();
        setIsDeleteLoading(false);
        toast.success('🗑️ Token deleted !', toastOptions);
      }
    } catch (error) {
      setIsDeleteLoading(false);
      toast.error('Failed to delete the token', toastOptions);
    } finally {
      setIsDeleteLoading(false);
      setDeletingToken(undefined);
    }
  };

  return (
    <>
      <div className={classes.containerSetting}>
        <div className={classes.settingCategory}>
          <h2 style={{ alignSelf: 'baseline' }}>Generate token</h2>
          <Link
            style={{ alignSelf: 'baseline', marginLeft: '5px' }}
            href='https://borgwarehouse.com/docs/developer-manual/api/'
            rel='noreferrer'
            target='_blank'
          >
            <IconExternalLink size={16} color='#6c737f' />
          </Link>
        </div>
        <div className={classes.setting}>
          <form
            onSubmit={handleSubmit(formSubmitHandler)}
            className={[classes.bwForm, classes.tokenGen].join(' ')}
          >
            <div className={classes.tokenWrapper}>
              <input
                type='text'
                autoComplete='off'
                placeholder='Token name'
                {...register('tokenName', {
                  required: true,
                  pattern: /^[a-zA-Z0-9_-]*$/,
                  maxLength: 25,
                })}
              />

              <div className={classes.permissionsWrapper}>
                <div
                  className={`${classes.permissionBadge} ${permissions.create ? classes.highlight : ''}`}
                  onClick={() => togglePermission(TokenPermissionEnum.CREATE)}
                >
                  Create
                </div>
                <div
                  className={`${classes.permissionBadge} ${permissions.read ? classes.highlight : ''}`}
                  onClick={() => togglePermission(TokenPermissionEnum.READ)}
                >
                  Read
                </div>
                <div
                  className={`${classes.permissionBadge} ${permissions.update ? classes.highlight : ''}`}
                  onClick={() => togglePermission(TokenPermissionEnum.UPDATE)}
                >
                  Update
                </div>
                <div
                  className={`${classes.permissionBadge} ${permissions.delete ? classes.highlight : ''}`}
                  onClick={() => togglePermission(TokenPermissionEnum.DELETE)}
                >
                  Delete
                </div>
              </div>
            </div>

            <button
              className={classes.AccountSettingsButton}
              disabled={!isValid || isSubmitting || hasNoPermissionSelected()}
            >
              Generate
            </button>
          </form>
          {errors.tokenName && errors.tokenName.type === 'maxLength' && (
            <small className={classes.errorMessage}>25 characters max.</small>
          )}
          {errors.tokenName && errors.tokenName.type === 'pattern' && (
            <small className={classes.errorMessage}>
              Only alphanumeric characters, dashes, and underscores are allowed (no spaces).
            </small>
          )}
          {error && <Error message={error} />}
        </div>
      </div>
      {tokenList && tokenList.length > 0 && (
        <div className={classes.containerSetting}>
          <div className={classes.settingCategory}>
            <h2>API Tokens</h2>
          </div>
          <div className={classes.tokenCardList}>
            {tokenList
              .slice()
              .sort((a, b) => b.creation - a.creation)
              .map((token, index) => (
                <div key={index} className={classes.tokenCardWrapper}>
                  <div
                    className={`${classes.tokenCard} ${
                      lastGeneratedToken && lastGeneratedToken.name === token.name
                        ? classes.tokenCardHighlight
                        : ''
                    } ${deletingToken && deletingToken.name === token.name ? classes.tokenCardBlurred : ''}`}
                  >
                    <div className={classes.tokenCardHeader}>{token.name}</div>
                    <div className={classes.tokenCardBody}>
                      <div className={classes.tokenInfo}>
                        <strong>Created at:</strong>
                        {fromUnixTime(token.creation).toLocaleString()}
                      </div>
                      <div className={classes.tokenInfo}>
                        <strong>Permission:</strong>
                        <div className={classes.permissionBadges}>
                          {renderPermissionBadges(token.permissions)}
                        </div>
                      </div>
                      {lastGeneratedToken && lastGeneratedToken.name === token.name && (
                        <>
                          <div className={classes.tokenInfo}>
                            <strong>Token:</strong>
                            <CopyButton
                              size={22}
                              displayIconConfirmation={true}
                              dataToCopy={lastGeneratedToken.value}
                            >
                              <span>{lastGeneratedToken.value}</span>
                            </CopyButton>
                          </div>
                          <Info
                            color='#3498db'
                            message='This token will not be shown again. Please save it.'
                          />
                        </>
                      )}
                      {deletingToken && deletingToken.name === token.name && (
                        <div className={classes.deleteConfirmationButtons}>
                          <button
                            className={classes.confirmButton}
                            onClick={() => deleteTokenHandler(token.name)}
                            disabled={isDeleteLoading}
                          >
                            Confirm
                          </button>
                          {!isDeleteLoading && (
                            <button
                              className={classes.cancelButton}
                              onClick={() => setDeletingToken(undefined)}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={classes.deleteToken}>
                    <IconTrash
                      cursor={'pointer'}
                      color='#ea1313'
                      strokeWidth={2}
                      onClick={() => setDeletingToken(token)}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  );
}
