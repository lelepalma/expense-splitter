import React, { useState, useMemo, useEffect, useCallback } from 'react'; // Added useCallback
import { Plus, Edit2, Trash2, Users, Download, Upload, Calculator, LogOut, Save, FileUp, Menu as MenuIcon } from 'lucide-react'; // Removed LogIn, Added MenuIcon
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // Corrected import


// Detect Safari on iOS
// import { gapi } from 'gapi-script'; // Removed gapi-script import

// IMPORTANT:
// 1. Ensure the Google Picker API is enabled in your Google Cloud Console project.
// 2. Replace GOOGLE_API_KEY below with your actual API key.

// Placeholder for Google OAuth Client ID
const isSafariMobile = /^((?!chrome|android).)*safari/i.test(navigator.userAgent.toLowerCase());

// IMPORTANT: GOOGLE_OAUTH_CLIENT_ID and SCOPES are used by functions before component initialization.
// Ensure they are defined globally or passed correctly.
const GOOGLE_OAUTH_CLIENT_ID = "215117254956-jk2m2upc45k6s65q56vh03g9utr7lr33.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file"; // Added Drive scope, now uncommented

// This function will handle the token response.
// It needs access to setGisAccessToken and setExportStatus, which are component state setters.
// We will define it inside the component or pass setters to it.
// For now, let's define its structure and move the logic from handleSignInWithGoogleCallback here.

let topLevelTokenClient; // Renamed to avoid confusion with tokenClient inside component functions

// We will initialize topLevelTokenClient within useEffect after GIS is loaded.

const GOOGLE_API_KEY = "AIzaSyCaXBZOn7V5Ufn86flW0wLNRupzhWqfjw4";
// const API_KEY = "AIzaSyCaXBZOn7V5Ufn86flW0wLNRupzhWqfjw4"; // Removed API_KEY
// Note: DISCOVERY_DOCS for sheets is not strictly needed if only using Drive.
// However, if both are intended, list them:
// const DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4", "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
// const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]; // Commented out DISCOVERY_DOCS
// const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file"; // Moved up
// TODO: IMPORTANT - Replace with your actual Google Cloud API Key
// const GOOGLE_API_KEY = "AIzaSyCaXBZOn7V5Ufn86flW0wLNRupzhWqfjw4"; // This was the duplicate
// const API_KEY = "AIzaSyCaXBZOn7V5Ufn86flW0wLNRupzhWqfjw4"; // Removed API_KEY
// Note: DISCOVERY_DOCS for sheets is not strictly needed if only using Drive.
// However, if both are intended, list them:
// const DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4", "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
// const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]; // Commented out DISCOVERY_DOCS
// const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file"; // This was also a duplicate, already handled by the one above the component.

const ExpenseSplitter = () => {
  const [gisAccessToken, setGisAccessToken] = useState(null); // Added state for GIS Access Token
  const [participants, setParticipants] = useState(['Alice', 'Bob', 'Charlie']);
  const [expenses, setExpenses] = useState([
    { id: 1, date: '2025-06-25', payee: 'Alice', description: 'Dinner', amount: 120, splits: { Alice: 40, Bob: 40, Charlie: 40 } },
    { id: 2, date: '2025-06-26', payee: 'Bob', description: 'Gas', amount: 60, splits: { Alice: 20, Bob: 20, Charlie: 20 } }
  ]);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [newParticipant, setNewParticipant] = useState('');
  const [newExpense, setNewExpense] = useState({
    date: new Date().toISOString().split('T')[0],
    payee: '',
    description: '',
    amount: '',
    splitType: 'equal'
  });
  const [exportStatus, setExportStatus] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  // const [authInstance, setAuthInstance] = useState(null); // Removed authInstance
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [isLoadingFromDrive, setIsLoadingFromDrive] = useState(false);
  const [isPickerApiLoaded, setIsPickerApiLoaded] = useState(false);
  const [showMenu, setShowMenu] = useState(false); // State for the new menu

  // --- Google API Functions --- (Old GAPI functions will be removed or refactored)

  // Defined AccessTokenResponseHandler at component level to use setters
  const handleAccessTokenResponseInternal = useCallback((tokenResponse) => {
    if (tokenResponse && tokenResponse.access_token) {
      setGisAccessToken(tokenResponse.access_token);
      setIsAuthenticated(true); // Also set authenticated true here
      setExportStatus('✅ Access Token obtained!');
      console.log('Access Token:', tokenResponse.access_token);
      // Optionally decode ID token for user info if not already done
      // Or fetch user profile using the access token
    } else {
      setExportStatus('❌ Failed to obtain Access Token.');
      console.error('Failed to obtain access token', tokenResponse);
      setIsAuthenticated(false);
    }
    setTimeout(() => setExportStatus(''), 5000);
  }, [setGisAccessToken, setExportStatus, setIsAuthenticated]); // Added setIsAuthenticated

  const handleSignInWithGoogleCallback = useCallback((response) => {
    console.log('ID Token response:', response);
    // This callback is primarily for the One Tap or Sign In With Google button press.
    // It gives an ID token. For Safari mobile, we'll initiate a code flow.
    // For other browsers, we can use this ID token to imply authentication and then request an access token.

    // For non-Safari, we assume the ID token means basic auth is successful,
    // then we try to get an access token.
    // If isSafariMobile, this callback will trigger the redirect flow.
    // The actual access token acquisition for Safari will happen after redirect.
    if (!isSafariMobile) {
      setIsAuthenticated(true); // Assume authenticated after ID token
      // User info from ID token can be decoded here if needed:
      // try {
      //   const idToken = jwt_decode(response.credential); // Requires a JWT decoding library
      //   setUserInfo({ name: idToken.name, email: idToken.email, imageUrl: idToken.picture });
      // } catch (e) { console.error("Error decoding ID token", e); }
      setExportStatus('✅ Sign-in successful. Requesting Access Token...');
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_OAUTH_CLIENT_ID,
          scope: SCOPES,
          callback: handleAccessTokenResponseInternal,
          error_callback: (error) => {
            console.error('Access Token Error:', error);
            setExportStatus(`❌ Access Token Error: ${error.type || error.message || 'Unknown error'}`);
            setIsAuthenticated(false);
            setTimeout(() => setExportStatus(''), 5000);
          }
        });
        tokenClient.requestAccessToken();
      } else {
        console.error('Google OAuth2 client not available for token request.');
        setExportStatus('❌ Google OAuth2 client not ready for token request.');
        setIsAuthenticated(false);
        setTimeout(() => setExportStatus(''), 5000);
      }
    } else {
      // For Safari mobile, initiate the redirect code flow.
      // The actual token exchange will happen after the redirect.
      console.log('Safari mobile detected. Initiating redirect code flow...');
      setExportStatus('🚀 Safari mobile: Redirecting for authorization...');
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        // Generate and store state for CSRF protection
        const state = Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('google_auth_state_generated', state);
        console.log('Generated state for CSRF:', state);

        const codeClient = window.google.accounts.oauth2.initCodeClient({
          client_id: GOOGLE_OAUTH_CLIENT_ID,
          scope: SCOPES,
          ux_mode: 'redirect',
          redirect_uri: window.location.origin + '/auth-callback.html',
          state: state, // Add state for CSRF protection
        });
        codeClient.requestCode();
      } else {
        console.error('Google OAuth2 client not available for redirect.');
        setExportStatus('❌ Google OAuth2 client not ready for redirect.');
        setTimeout(() => setExportStatus(''), 5000);
      }
    }
  }, [setIsAuthenticated, setExportStatus, handleAccessTokenResponseInternal, setUserInfo, isSafariMobile]);


  // Effect to handle GIS initialization and rendering the sign-in button
  useEffect(() => {
    const initializeGis = () => {
      if (window.google && window.google.accounts && window.google.accounts.id && window.google.accounts.oauth2) {
        console.log('GIS client (id and oauth2) found, initializing ID services...');
        window.google.accounts.id.initialize({
          client_id: GOOGLE_OAUTH_CLIENT_ID,
          callback: handleSignInWithGoogleCallback,
        });
        console.log('GIS ID services initialized.');

        const signInButtonContainer = document.getElementById('signInDiv');
        if (signInButtonContainer && !signInButtonContainer.hasChildNodes()) { // Render only if not already rendered
            window.google.accounts.id.renderButton(
                signInButtonContainer,
                { theme: 'outline', size: 'large', type: 'standard', text: 'signin_with' }
            );
            console.log('GIS Sign-In button rendered.');
        } else if (!signInButtonContainer) {
            console.error('signInDiv not found for GIS button rendering.');
        }
      } else {
        console.warn('GIS client (id or oauth2) not ready yet, retrying in 500ms...');
        setTimeout(initializeGis, 500);
      }
    };
    initializeGis();
  }, [handleSignInWithGoogleCallback]);

  // Effect to handle the redirect callback for authorization code
  useEffect(() => {
    const authCode = localStorage.getItem('google_auth_code');
    const receivedState = localStorage.getItem('google_auth_state_received');
    const generatedState = sessionStorage.getItem('google_auth_state_generated');
    const authError = localStorage.getItem('google_auth_error');

    // Clear localStorage items immediately after reading them
    localStorage.removeItem('google_auth_code');
    localStorage.removeItem('google_auth_state_received');
    localStorage.removeItem('google_auth_error');
    // Do not clear sessionStorage.getItem('google_auth_state_generated') here,
    // it's cleared after successful validation or if not needed.

    if (authError) {
      console.error('Error from auth callback:', authError);
      setExportStatus(`❌ Authentication Error: ${authError}`);
      setIsAuthenticated(false);
      setTimeout(() => setExportStatus(''), 7000);
      sessionStorage.removeItem('google_auth_state_generated'); // Clean up state
      return;
    }

    if (authCode) {
      console.log('Received auth code from localStorage:', authCode);
      console.log('Received state from localStorage:', receivedState);
      console.log('Generated state from sessionStorage:', generatedState);

      if (isSafariMobile) { // Only proceed if this flow was initiated by Safari Mobile logic
        if (!generatedState || receivedState !== generatedState) {
          console.error('State mismatch for CSRF protection. Aborting token exchange.');
          setExportStatus('❌ CSRF Warning: State mismatch. Please try signing in again.');
          setIsAuthenticated(false);
          sessionStorage.removeItem('google_auth_state_generated'); // Clean up state
          setTimeout(() => setExportStatus(''), 7000);
          return;
        }
        console.log('State validated successfully.');
        sessionStorage.removeItem('google_auth_state_generated'); // Clean up state after successful validation

        setExportStatus('⏳ Exchanging authorization code for token...');
        const tokenRequestBody = new URLSearchParams();
        tokenRequestBody.append('code', authCode);
        tokenRequestBody.append('client_id', GOOGLE_OAUTH_CLIENT_ID);
        tokenRequestBody.append('redirect_uri', window.location.origin + '/auth-callback.html');
        tokenRequestBody.append('grant_type', 'authorization_code');

        fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: tokenRequestBody.toString(),
        })
        .then(response => response.json())
        .then(data => {
          if (data.access_token) {
            console.log('Token exchange successful:', data);
            handleAccessTokenResponseInternal(data); // Use the common handler
          } else {
            console.error('Token exchange failed:', data);
            setExportStatus(`❌ Token Exchange Failed: ${data.error_description || data.error || 'Unknown error'}`);
            setIsAuthenticated(false);
            setTimeout(() => setExportStatus(''), 7000);
          }
        })
        .catch(error => {
          console.error('Error during token exchange:', error);
          setExportStatus(`❌ Token Exchange Error: ${error.message}`);
          setIsAuthenticated(false);
          setTimeout(() => setExportStatus(''), 7000);
        });
      } else {
        // If not Safari Mobile, this code might be from a previous unfinished attempt.
        // It's generally safer to ignore it if the main flow didn't expect it.
        console.warn("Auth code found but not processed as it's not Safari Mobile context or state mismatch.");
        sessionStorage.removeItem('google_auth_state_generated'); // Clean up state
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount to check for redirect parameters. Dependencies: handleAccessTokenResponseInternal if it changes.

  useEffect(() => {
    const loadPickerApi = () => {
      if (window.gapi && window.gapi.load) {
        window.gapi.load('picker', { 'callback': () => {
          console.log('Google Picker API loaded.');
          setIsPickerApiLoaded(true);
        }});
      } else {
        console.warn('gapi client not ready yet for Picker, retrying in 500ms...');
        setTimeout(loadPickerApi, 500);
      }
    };
    loadPickerApi();
  }, []);


const handleLoadFromDrive = async () => {
  if (!gisAccessToken) {
    setExportStatus("❌ Access Token not available. Please sign in again.");
    setTimeout(() => setExportStatus(''), 3000);
    return;
  }
  const fileId = localStorage.getItem('tripJsonFileId');
  if (!fileId) {
    setExportStatus("ℹ️ No file previously saved to Drive to load.");
    setTimeout(() => setExportStatus(''), 3000);
    return;
  }

  setIsLoadingFromDrive(true);
  setExportStatus('Loading from Drive...');

  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${gisAccessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); // Try to parse error, default to empty obj
      console.error('Drive API Error Response (Load):', errorData);
      // Check for 404 specifically, as it's a common case
      if (response.status === 404) {
        localStorage.removeItem('tripJsonFileId'); // Clear stale file ID
        throw new Error(`File not found on Drive (ID: ${fileId}).`);
      }
      throw new Error(`Drive API Error: ${response.status} ${response.statusText}. ${errorData?.error?.message || ''}`);
    }

    const fileContent = await response.json(); // Assuming the file content is JSON

    if (fileContent && Array.isArray(fileContent.participants) && Array.isArray(fileContent.expenses)) {
      setParticipants(fileContent.participants);
      setExpenses(fileContent.expenses);
      setExportStatus('✅ Data loaded from Drive');
      console.log('Data loaded from Drive:', fileContent);
    } else {
      throw new Error("Invalid file format or missing data from Drive file.");
    }

  } catch (error) {
    console.error('Error loading from Drive:', error);
    let errorMessage = error.message || 'Unknown error';
    if (error.message?.includes("File not found on Drive")) {
        errorMessage = "❌ File not found on Drive. It might have been deleted or permissions changed.";
        localStorage.removeItem('tripJsonFileId'); // Ensure stale ID is cleared
    } else if (error instanceof SyntaxError) { // Error parsing the JSON from Drive
        errorMessage = '❌ Failed to parse file from Drive (invalid JSON).';
    } else if (error.message?.includes("Drive API Error")) { // Error from the fetch response.ok check
        errorMessage = `❌ Load from Drive failed: ${error.message}`;
    } else { // Other generic errors
        errorMessage = `❌ Load from Drive failed: ${errorMessage}`;
    }
    setExportStatus(errorMessage);
  } finally {
    setIsLoadingFromDrive(false);
    setTimeout(() => setExportStatus(''), 5000);
  }
};

  // initClient, updateSigninStatus, useEffect for GAPI init are removed.
  // GIS initialization will be handled differently.

  // const handleSignIn = useCallback(() => { // Commenting out old GAPI based signIn
  //   // This function will be entirely replaced by GIS logic
  //   console.error("handleSignIn needs to be refactored for GIS.");
  //   setExportStatus("❌ Sign-in logic not updated for GIS yet.");
  //   setTimeout(() => setExportStatus(''), 3000);
  // }, [/* authInstance, */ setExportStatus]);

  const handleSignOut = useCallback(() => {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    // Revoke access token if it exists
    if (gisAccessToken && window.google && window.google.accounts && window.google.accounts.oauth2) {
      window.google.accounts.oauth2.revoke(gisAccessToken, () => {
        console.log('GIS Access token revoked.');
        setExportStatus('ⓘ Access token revoked.');
        setTimeout(() => setExportStatus(''), 3000);
      });
    }
    setGisAccessToken(null); // Clear access token from state

    setIsAuthenticated(false);
    setUserInfo(null);
    console.log('User signed out via GIS.');
    setExportStatus('ⓘ Signed out.'); // This might overwrite the "token revoked" message quickly
    setTimeout(() => setExportStatus(''), 3000);
  }, [gisAccessToken, setIsAuthenticated, setUserInfo, setExportStatus, setGisAccessToken]); // Added gisAccessToken and setGisAccessToken to dependencies

  const handleDownloadJson = async () => {
    setExportStatus('Preparing JSON download...');
    try {
      const dataToSave = JSON.stringify({ participants, expenses, balances, settlements }, null, 2);
      const blob = new Blob([dataToSave], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = 'trip_expenses.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
      setExportStatus('✅ JSON downloaded.');
    } catch (error) {
      console.error('Error downloading JSON:', error);
      setExportStatus('❌ JSON download failed.');
    } finally {
      setTimeout(() => setExportStatus(''), 3000);
    }
  };

  const handleSaveToDrive = async () => {
    if (!gisAccessToken) {
      setExportStatus("❌ Access Token not available. Please sign in again.");
      setTimeout(() => setExportStatus(''), 3000);
      return;
    }

    setIsSavingToDrive(true);
    setExportStatus('Saving to Drive...');

    const dataToSave = JSON.stringify({ participants, expenses, balances, settlements }, null, 2);
    const fileId = localStorage.getItem('tripJsonFileId');
    const fileName = 'trip_expenses.json';

    const boundary = '-------314159265358979323846'; // Used in multipart body
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const driveMetadata = { // Renamed to avoid conflict with 'metadata' variable if any
      name: fileName,
      mimeType: 'application/json',
    };

    let multipartRequestBody;
    let uploadPath; // Renamed from path to avoid conflict with possible window.path
    let httpMethod; // Renamed from method to avoid conflict

    if (fileId) {
      uploadPath = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
      httpMethod = 'PATCH';
      multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify({ name: fileName }) + // Only metadata that needs updating for PATCH (e.g. name if changed)
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        dataToSave +
        close_delim;
    } else {
      uploadPath = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
      httpMethod = 'POST';
      multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(driveMetadata) + // Full metadata for new file
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        dataToSave +
        close_delim;
    }

    try {
      const response = await fetch(uploadPath, {
        method: httpMethod,
        headers: {
          'Authorization': `Bearer ${gisAccessToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"` // Ensure boundary is quoted here
        },
        body: multipartRequestBody,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Try to parse error, default to empty obj
        console.error('Drive API Error Response:', errorData);
        throw new Error(`Drive API Error: ${response.status} ${response.statusText}. ${errorData?.error?.message || ''}`);
      }

      const responseData = await response.json();
      const newFileId = responseData.id;
      localStorage.setItem('tripJsonFileId', newFileId);
      setExportStatus('✅ Saved to Drive');
      console.log('File saved/updated with ID:', newFileId);

    } catch (error) {
      console.error('Error saving to Drive:', error);
      // Attempt to check for specific Drive API error structure if available
      const driveError = error.message?.includes("Drive API Error:") ? error.message :
                         (error.result?.error?.message || error.message || 'Unknown error');
      setExportStatus(`❌ Save to Drive failed: ${driveError}`);

      // Check if the error from response.ok was a 404, and if we were trying to update
      if (error.message && error.message.includes("404") && fileId) {
        localStorage.removeItem('tripJsonFileId');
        setExportStatus('❌ Save failed (File not found on Drive, try saving again to create a new file)');
      }
    } finally {
      setIsSavingToDrive(false);
      setTimeout(() => setExportStatus(''), 5000);
    }
  };

  const uploadFileToDrive = async (fileName, folderId) => {
    if (!gisAccessToken) {
      setExportStatus("❌ Access Token not available for upload.");
      setTimeout(() => setExportStatus(''), 3000);
      return;
    }

    setIsSavingToDrive(true); // Use existing state for loading indicator
    setExportStatus(`Saving "${fileName}" to Drive...`);

    const dataToSave = JSON.stringify({ participants, expenses, balances, settlements }, null, 2);
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const driveMetadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: [folderId] // Specify the parent folder
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(driveMetadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      dataToSave +
      close_delim;

    try {
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST', // Always POST for creating new files
        headers: {
          'Authorization': `Bearer ${gisAccessToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`
        },
        body: multipartRequestBody,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Drive API Error Response (Save As):', errorData);
        throw new Error(`Drive API Error: ${response.status} ${response.statusText}. ${errorData?.error?.message || ''}`);
      }

      const responseData = await response.json();
      const newFileId = responseData.id;
      localStorage.setItem('tripJsonFileId', newFileId);
      setExportStatus(`✅ "${fileName}" saved to Drive (ID: ${newFileId}). Ready for Quick Save.`);
      console.log('File saved with ID:', newFileId);

    } catch (error) {
      console.error('Error saving to Drive (Save As):', error);
      setExportStatus(`❌ Save As to Drive failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSavingToDrive(false);
      setTimeout(() => setExportStatus(''), 5000);
    }
  };

  const handleSaveAsToDrive = () => {
    if (!isAuthenticated || !gisAccessToken || !isPickerApiLoaded || !window.google || !window.google.picker) {
      let message = "❌ Cannot save: Authentication or token not ready.";
      if (!isPickerApiLoaded) {
        message = "❌ Cannot save: Picker API not loaded. Check API key and Picker API enablement in Google Cloud Console.";
      } else if (!window.google?.picker) {
        message = "❌ Cannot save: Picker functionality not available.";
      }
      setExportStatus(message);
      console.error('Save As Pre-requisites not met:', { isAuthenticated, gisAccessToken, isPickerApiLoaded, pickerExists: !!window.google?.picker });
      setTimeout(() => setExportStatus(''), 5000); // Increased timeout for this important message
      return;
    }

    const fileName = prompt("Enter file name for Google Drive:", "trip_expenses_new.json");
    if (!fileName) {
      setExportStatus("ℹ️ Save As cancelled by user.");
      setTimeout(() => setExportStatus(''), 3000);
      return;
    }

    const createPicker = () => {
      const view = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true);


      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .setTitle("Select a folder to save in")
        .setOAuthToken(gisAccessToken)
        .setDeveloperKey(GOOGLE_API_KEY)
        .enableFeature(window.google.picker.Feature.SUPPORT_DRIVES) // Optional, allows access to shared drives
        .setSelectableMimeTypes('application/vnd.google-apps.folder') // ✅ critical for enabling the Select button
        .setCallback((data) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const folder = data.docs[0];
            if (folder && folder.id) {
              const folderId = folder.id;
              setExportStatus(`Folder selected: ${folder.name}. Preparing to save...`);
              // Proceed to upload the file to this folderId with the prompted fileName
              uploadFileToDrive(fileName, folderId);
            } else {
              setExportStatus("❌ No folder selected or folder ID missing.");
              setTimeout(() => setExportStatus(''), 3000);
            }
          } else if (data.action === window.google.picker.Action.CANCEL) {
            setExportStatus("ℹ️ Save As (folder selection) cancelled.");
            setTimeout(() => setExportStatus(''), 3000);
          }
        })
        .build();
      picker.setVisible(true);
    };
    createPicker();
  };

  const handlePickFromDrive = () => {
    if (!isAuthenticated || !gisAccessToken || !isPickerApiLoaded || !window.google || !window.google.picker) {
      let message = "❌ Cannot open: Authentication or token not ready.";
      if (!isPickerApiLoaded) {
        message = "❌ Cannot open: Picker API not loaded. Check API key and Picker API enablement in Google Cloud Console.";
      } else if (!window.google?.picker) {
        message = "❌ Cannot open: Picker functionality not available.";
      }
      setExportStatus(message);
      console.error('Pick from Drive Pre-requisites not met:', { isAuthenticated, gisAccessToken, isPickerApiLoaded, pickerExists: !!window.google?.picker });
      setTimeout(() => setExportStatus(''), 5000); // Increased timeout
      return;
    }

    const createPicker = () => {
      const docsView = new window.google.picker.DocsView()
        .setIncludeFolders(false) // We want files, not folders
        .setMimeTypes('application/json')
        .setOwnedByMe(true); // Optional: Start with user's own files

      const picker = new window.google.picker.PickerBuilder()
        .addView(docsView)
        .setTitle("Select a JSON expense file")
        .setOAuthToken(gisAccessToken)
        .setDeveloperKey(GOOGLE_API_KEY) // GOOGLE_API_KEY from previous steps
        .setCallback(async (data) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const file = data.docs[0];
            if (file && file.id) {
              setExportStatus(`File selected: ${file.name}. Loading...`);
              setIsLoadingFromDrive(true); // Use existing state for loading indicator

              try {
                const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${gisAccessToken}`,
                  },
                });

                if (!response.ok) {
                  const errorData = await response.json().catch(() => ({}));
                  console.error('Drive API Error Response (Pick):', errorData);
                  throw new Error(`Drive API Error: ${response.status} ${response.statusText}. ${errorData?.error?.message || ''}`);
                }

                const fileContent = await response.json();

                if (fileContent && Array.isArray(fileContent.participants) && Array.isArray(fileContent.expenses)) {
                  setParticipants(fileContent.participants);
                  setExpenses(fileContent.expenses);
                  localStorage.setItem('tripJsonFileId', file.id);
                  setExportStatus(`✅ Data loaded from "${file.name}" (ID: ${file.id}). Ready for Quick Save.`);
                  console.log('Data loaded from Drive via Picker:', fileContent);
                } else {
                  throw new Error("Invalid file format or missing data from Drive file.");
                }

              } catch (error) {
                console.error('Error loading from Drive (Picker):', error);
                let errorMessage = error.message || 'Unknown error';
                if (error instanceof SyntaxError) {
                    errorMessage = '❌ Failed to parse file from Drive (invalid JSON).';
                } else if (error.message?.includes("Drive API Error")) {
                    errorMessage = `❌ Load from Drive failed: ${error.message}`;
                } else {
                    errorMessage = `❌ Load from Drive failed: ${errorMessage}`;
                }
                setExportStatus(errorMessage);
              } finally {
                setIsLoadingFromDrive(false);
                setTimeout(() => setExportStatus(''), 5000);
              }

            } else {
              setExportStatus("❌ No file selected or file ID missing.");
              setTimeout(() => setExportStatus(''), 3000);
            }
          } else if (data.action === window.google.picker.Action.CANCEL) {
            setExportStatus("ℹ️ Open from Drive (file selection) cancelled.");
            setTimeout(() => setExportStatus(''), 3000);
          }
        })
        .build();
      picker.setVisible(true);
    };
    createPicker();
  };

  const exportToPdf = async () => {
    setExportStatus('Exporting...');
    try {
      const doc = new jsPDF();

      // Expenses Ledger Table
      const expenseHeaders = ["Date", "Payee", "Description", "Amount", ...participants];

      // PDF-specific calculation for display
      const pdfParticipantTotals = {};
      participants.forEach(p => { pdfParticipantTotals[p] = 0; });

      const expenseRows = expenses.map(expense => {
        const row = [
          expense.date,
          expense.payee,
          expense.description,
          `€ ${expense.amount.toFixed(2)}`, // EUR formatting with space
        ];

        const n = participants.length;
        const baseShare = n > 0 ? expense.amount / n : 0;

        participants.forEach(p_inner => {
          let pdfDisplayValue = 0;
          if (n > 0) { // Avoid division by zero if no participants somehow
            if (p_inner === expense.payee) {
              pdfDisplayValue = baseShare * (n - 1);
            } else {
              pdfDisplayValue = -baseShare;
            }
          }
          pdfParticipantTotals[p_inner] += pdfDisplayValue;
          row.push(`€ ${pdfDisplayValue.toFixed(2)}`);
        });
        return row;
      });

      // Expenses Table Title
      doc.setFontSize(14);
      doc.text("Expenses", 14, 15);

      // Prepare Total Balance Row for PDF display
      const totalExpensesSum = expenses.reduce((sum, e) => sum + e.amount, 0);
      const pdfParticipantTotalStrings = participants.map(p => {
        return `€ ${pdfParticipantTotals[p].toFixed(2)}`;
      });

      const totalBalanceRow = [
        '', // Date
        '', // Payee
        { content: 'Total Balance:', styles: { halign: 'right', fontStyle: 'bold'} }, // Description
        { content: `€ ${totalExpensesSum.toFixed(2)}`, styles: { fontStyle: 'bold'} }, // Amount (Overall total)
        ...pdfParticipantTotalStrings.map(balStr => ({ content: balStr, styles: { fontStyle: 'bold'} })) // PDF specific totals
      ];

      const finalExpenseRows = [...expenseRows, totalBalanceRow];

      doc.autoTable({
        head: [expenseHeaders],
        body: finalExpenseRows, // Use rows with PDF-specific display logic and totals
        startY: 22, // Adjusted for title
        headStyles: { halign: 'center', fillColor: [22, 160, 133] },
        styles: { fontSize: 8, halign: 'center' },
        didDrawCell: (data) => {
          // Check if it's the last row of the body (Total Balance row)
          if (data.table.body.length > 0 && data.row.index === data.table.body.length - 1) {
            // The fontStyle is now set directly in the cell's `styles` object for the totalBalanceRow
            // For a full row background color (optional, more complex):
            // doc.setFillColor(240, 240, 240);
            // doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
            // doc.setTextColor(0, 0, 0); // Reset text color if needed
          }
        }
      });

      // Settlement Summary Table Title
      let settlementsY = doc.lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text("Settlements Summary", 14, settlementsY);

      if (settlements.length > 0) {
        const settlementHeaders = ["From", "To", "Amount"];
        const settlementRows = settlements.map(settlement => [
          settlement.from,
          settlement.to,
          `€ ${settlement.amount.toFixed(2)}` // EUR formatting with space
        ]);

        doc.autoTable({
          head: [settlementHeaders],
          body: settlementRows,
          startY: settlementsY + 7, // Adjusted for title
          headStyles: { halign: 'center', fillColor: [22, 160, 133] },
          styles: { fontSize: 8, halign: 'center' },
        });
      } else {
        // Position "No settlements" text after the "Settlements Summary" title
        const text = "No settlements needed - everyone is even!";
        // Font size for this text should ideally be the default or smaller than title
        doc.setFontSize(10); // Resetting to a smaller size for this message
        const textWidth = doc.getStringUnitWidth(text) * doc.internal.getFontSize() / doc.internal.scaleFactor;
        const pageWidth = doc.internal.pageSize.getWidth();
        const x = (pageWidth - textWidth) / 2;
        doc.text(text, x, settlementsY + 7); // Positioned after title space
      }

      doc.save('expense_report.pdf');
      setExportStatus('✅ PDF exported!');
    } catch (error) {
      console.error('PDF Export failed:', error);
      setExportStatus('❌ Export failed');
    } finally {
      setTimeout(() => setExportStatus(''), 3000);
    }
  };

  // Calculate balances
  const balances = useMemo(() => {
    const balanceMap = {};
    participants.forEach(p => balanceMap[p] = 0);

    expenses.forEach(expense => {
      // Add what they paid
      balanceMap[expense.payee] += expense.amount;
      // Subtract what they owe
      Object.entries(expense.splits).forEach(([person, amount]) => {
        balanceMap[person] -= amount;
      });
    });

    return balanceMap;
  }, [participants, expenses]);

  // Calculate who owes whom
  const settlements = useMemo(() => {
    const creditors = [];
    const debtors = [];

    Object.entries(balances).forEach(([person, balance]) => {
      if (balance > 0.01) creditors.push({ person, amount: balance });
      if (balance < -0.01) debtors.push({ person, amount: -balance });
    });

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const transactions = [];
    let i = 0, j = 0;

    while (i < creditors.length && j < debtors.length) {
      const creditor = creditors[i];
      const debtor = debtors[j];
      const amount = Math.min(creditor.amount, debtor.amount);

      if (amount > 0.01) {
        transactions.push({
          from: debtor.person,
          to: creditor.person,
          amount: amount
        });
      }

      creditor.amount -= amount;
      debtor.amount -= amount;

      if (creditor.amount < 0.01) i++;
      if (debtor.amount < 0.01) j++;
    }

    return transactions;
  }, [balances]);

  const addParticipant = () => {
    if (newParticipant.trim() && !participants.includes(newParticipant.trim())) {
      setParticipants([...participants, newParticipant.trim()]);
      setNewParticipant('');
      setShowAddParticipant(false);
    }
  };

  const removeParticipant = (name) => {
    if (participants.length > 2) {
      setParticipants(participants.filter(p => p !== name));
      setExpenses(expenses.filter(e => e.payee !== name));
    }
  };

  const addExpense = () => {
    if (newExpense.payee && newExpense.amount && newExpense.description) {
      const amount = parseFloat(newExpense.amount);
      const splits = {};
      
      if (newExpense.splitType === 'equal') {
        const splitAmount = amount / participants.length;
        participants.forEach(p => splits[p] = splitAmount);
      }

      const expense = {
        id: Date.now(),
        date: newExpense.date,
        payee: newExpense.payee,
        description: newExpense.description,
        amount: amount,
        splits: splits
      };

      setExpenses([...expenses, expense]);
      setNewExpense({
        date: new Date().toISOString().split('T')[0],
        payee: '',
        description: '',
        amount: '',
        splitType: 'equal'
      });
      setShowAddExpense(false);
    }
  };

  const updateExpense = () => {
    if (editingExpense && editingExpense.payee && editingExpense.amount && editingExpense.description) {
      const amount = parseFloat(editingExpense.amount);
      const splits = {};
      
      if (editingExpense.splitType === 'equal') {
        const splitAmount = amount / participants.length;
        participants.forEach(p => splits[p] = splitAmount);
      }

      setExpenses(expenses.map(e => 
        e.id === editingExpense.id 
          ? { ...editingExpense, amount: amount, splits: splits }
          : e
      ));
      setEditingExpense(null);
    }
  };

  const deleteExpense = (id) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  // const exportData = async () => { // Commenting out old exportData
  //   try {
  //     const data = {
  //       participants,
  //       expenses,
  //       balances,
  //       settlements,
  //       exportDate: new Date().toISOString(),
  //       totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0)
  //     };
      
  //     const jsonString = JSON.stringify(data, null, 2);
      
  //     setExportStatus('Exporting...');
      
  //     // For mobile compatibility, try clipboard first
  //     if (navigator.clipboard && navigator.clipboard.writeText) {
  //       try {
  //         await navigator.clipboard.writeText(jsonString);
  //         setExportStatus('✅ Data copied to clipboard!');
  //         setTimeout(() => setExportStatus(''), 3000);
  //         return;
  //       } catch (clipboardErr) {
  //         console.log('Clipboard failed, trying other methods');
  //       }
  //     }
      
  //     // Try Web Share API if available (mobile)
  //     if (navigator.share) {
  //       try {
  //         await navigator.share({
  //           title: 'Expense Split Data',
  //           text: jsonString
  //         });
  //         setExportStatus('✅ Data shared successfully!');
  //         setTimeout(() => setExportStatus(''), 3000);
  //         return;
  //       } catch (shareErr) {
  //         console.log('Share failed, showing modal');
  //       }
  //     }
      
  //     // Fallback: show modal with data
  //     showExportModal(jsonString);
  //     setExportStatus('');
      
  //   } catch (error) {
  //     console.error('Export failed:', error);
  //     setExportStatus('❌ Export failed');
  //     setTimeout(() => setExportStatus(''), 3000);
  //   }
  // };

  // const showExportModal = (jsonString) => { // Removed function
  //   const modal = document.createElement('div');
  //   modal.style.cssText = `
  //     position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  //     background: rgba(0,0,0,0.8); z-index: 1000;
  //     display: flex; align-items: center; justify-content: center; padding: 20px;
  //   `;
    
  //   const content = document.createElement('div');
  //   content.style.cssText = `
  //     background: white; border-radius: 10px; padding: 20px;
  //     max-width: 90%; max-height: 80%; overflow: auto;
  //   `;
    
  //   content.innerHTML = `
  //     <h3 style="margin-top: 0;">Export Data</h3>
  //     <p>Copy the text below and save it as a .json file:</p>
  //     <textarea readonly style="width: 100%; height: 300px; font-family: monospace; font-size: 12px; border: 1px solid #ccc; padding: 10px;">${jsonString}</textarea>
  //     <button onclick="this.parentElement.parentElement.remove()" style="margin-top: 10px; padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 5px;">Close</button>
  //   `;
    
  //   modal.appendChild(content);
  //   document.body.appendChild(modal);
  // };

  const importData = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.participants && data.expenses && Array.isArray(data.participants) && Array.isArray(data.expenses)) {
            setParticipants(data.participants);
            setExpenses(data.expenses);
            setExportStatus('✅ Data imported successfully!');
            setTimeout(() => setExportStatus(''), 3000);
          } else {
            throw new Error('Invalid file structure.'); // Will be caught by catch block
          }
        } catch (error) {
          console.error('Import failed:', error);
          // Check if it's the specific "Invalid file structure" error we threw
          if (error.message === 'Invalid file structure.') {
            setExportStatus('❌ Import failed: Invalid file structure.');
          } else { // Generic error (e.g., JSON.parse failed)
            setExportStatus(`❌ Import failed: ${error.message || 'Invalid file format.'}`);
          }
          setTimeout(() => setExportStatus(''), 5000);
        }
      };
      reader.readAsText(file);
    }
    // Reset the input value so the same file can be selected again
    event.target.value = '';
  };

  const renderMenu = () => (
    <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
      <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
        <button
          onClick={() => { document.getElementById('import-file').click(); setShowMenu(false); }}
          className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
          role="menuitem"
        >
          <Upload size={18} />
          Upload JSON
        </button>
        <button
          onClick={() => { handleDownloadJson(); setShowMenu(false); }}
          className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
          role="menuitem"
        >
          <Download size={18} />
          Download JSON
        </button>
        {isAuthenticated && (
          <>
            <button
              onClick={() => { handleSaveToDrive(); setShowMenu(false); }}
              disabled={isSavingToDrive || isLoadingFromDrive || !gisAccessToken}
              className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
              role="menuitem"
            >
              <Save size={18} />
              {isSavingToDrive ? 'Saving...' : 'Quick Save'}
            </button>
            <button
              onClick={() => { handleLoadFromDrive(); setShowMenu(false); }}
              disabled={isLoadingFromDrive || isSavingToDrive || !gisAccessToken}
              className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
              role="menuitem"
            >
              <FileUp size={18} />
              {isLoadingFromDrive ? 'Loading...' : 'Load Last Saved'}
            </button>
            <button
              onClick={() => { handleSaveAsToDrive(); setShowMenu(false); }}
              disabled={isSavingToDrive || isLoadingFromDrive || !gisAccessToken || !isPickerApiLoaded}
              className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
              role="menuitem"
            >
              <Save size={18} />
              {isSavingToDrive ? 'Saving As...' : 'Save As to Drive'}
            </button>
            <button
              onClick={() => { handlePickFromDrive(); setShowMenu(false); }}
              disabled={isLoadingFromDrive || isSavingToDrive || !gisAccessToken || !isPickerApiLoaded}
              className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
              role="menuitem"
            >
              <Upload size={18} />
              {isLoadingFromDrive ? 'Opening...' : 'Open from Drive...'}
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Trip Expense Splitter</h1>
              <p className="text-gray-600">Track and split expenses fairly among participants</p>
            </div>
            <div className="flex gap-2 flex-wrap items-center"> {/* Added items-center for alignment */}
              {isAuthenticated && userInfo ? (
                <div className="flex items-center gap-2">
                  {userInfo.imageUrl && (
                    <img src={userInfo.imageUrl} alt={userInfo.name} className="w-8 h-8 rounded-full" />
                  )}
                  <span className="text-sm text-gray-700">Hi, {userInfo.name || userInfo.email}</span>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              ) : (
                // This div will host the Google Sign-In button
                <div id="signInDiv" className="flex justify-center"></div>
              )}

              {/* Group 4: Other Export Operations */}
              <button
                onClick={exportToPdf}
                disabled={exportStatus.includes('Exporting...')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg transition-colors"
              >
                <Download size={18} />
                Export PDF
              </button>

              {/* Menu Toggle Button */}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors text-gray-700"
                >
                  <MenuIcon size={18} />
                  Menu
                </button>
                {showMenu && renderMenu()}
              </div>

              {/* Status Display */}
              {exportStatus && (
                <div className={`flex items-center px-3 py-1.5 rounded-lg text-xs ${ /* Adjusted padding and text size */
                  exportStatus.startsWith('✅') ? 'bg-green-100 text-green-800' :
                  exportStatus.startsWith('❌') ? 'bg-red-100 text-red-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {exportStatus}
                </div>
              )}
              <input
                id="import-file"
                type="file"
                accept=".json"
                onChange={importData}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Participants Management */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="text-indigo-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-800">Participants</h2>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {participants.map(participant => (
              <div key={participant} className="flex items-center gap-2 bg-indigo-100 px-3 py-2 rounded-full">
                <span className="text-indigo-800 font-medium">{participant}</span>
                {participants.length > 2 && (
                  <button onClick={() => removeParticipant(participant)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {showAddParticipant ? (
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newParticipant}
                onChange={(e) => setNewParticipant(e.target.value)}
                placeholder="Participant name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyPress={(e) => e.key === 'Enter' && addParticipant()}
              />
              <button onClick={addParticipant} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                Add
              </button>
              <button onClick={() => setShowAddParticipant(false)} className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddParticipant(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <Plus size={18} />
              Add Participant
            </button>
          )}
        </div>

        {/* Add Expense */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Add Expense</h2>
          
          {showAddExpense || editingExpense ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <input
                type="date"
                value={editingExpense ? editingExpense.date : newExpense.date}
                onChange={(e) => editingExpense 
                  ? setEditingExpense({...editingExpense, date: e.target.value})
                  : setNewExpense({...newExpense, date: e.target.value})
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={editingExpense ? editingExpense.payee : newExpense.payee}
                onChange={(e) => editingExpense 
                  ? setEditingExpense({...editingExpense, payee: e.target.value})
                  : setNewExpense({...newExpense, payee: e.target.value})
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select payee</option>
                {participants.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Description"
                value={editingExpense ? editingExpense.description : newExpense.description}
                onChange={(e) => editingExpense 
                  ? setEditingExpense({...editingExpense, description: e.target.value})
                  : setNewExpense({...newExpense, description: e.target.value})
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Amount"
                value={editingExpense ? editingExpense.amount : newExpense.amount}
                onChange={(e) => editingExpense 
                  ? setEditingExpense({...editingExpense, amount: e.target.value})
                  : setNewExpense({...newExpense, amount: e.target.value})
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="md:col-span-2 lg:col-span-4 flex gap-2">
                <button
                  onClick={editingExpense ? updateExpense : addExpense}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  {editingExpense ? 'Update' : 'Add'} Expense
                </button>
                <button
                  onClick={() => {
                    setShowAddExpense(false);
                    setEditingExpense(null);
                    setNewExpense({
                      date: new Date().toISOString().split('T')[0],
                      payee: '',
                      description: '',
                      amount: '',
                      splitType: 'equal'
                    });
                  }}
                  className="px-6 py-2 bg-gray-300 hover:bg-gray-400 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddExpense(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <Plus size={18} />
              Add Expense
            </button>
          )}
        </div>

        {/* Expenses Table */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 overflow-hidden">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Expenses</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Payee</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Description</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700">Amount</th>
                  {participants.map(p => (
                    <th key={p} className="text-right py-3 px-2 font-semibold text-gray-700 min-w-20">{p}</th>
                  ))}
                  <th className="text-center py-3 px-2 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(expense => (
                  <tr key={expense.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2 text-sm">{expense.date}</td>
                    <td className="py-3 px-2 text-sm font-medium">{expense.payee}</td>
                    <td className="py-3 px-2 text-sm">{expense.description}</td>
                    <td className="py-3 px-2 text-sm text-right font-semibold">${expense.amount.toFixed(2)}</td>
                    {participants.map(p => {
                      const split = expense.splits[p] || 0;
                      const netAmount = (p === expense.payee ? expense.amount - split : -split);
                      return (
                        <td key={p} className={`py-3 px-2 text-sm text-right font-medium ${
                          netAmount > 0 ? 'text-green-600' : netAmount < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {netAmount > 0 ? '+' : ''}${netAmount.toFixed(2)}
                        </td>
                      );
                    })}
                    <td className="py-3 px-2 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => setEditingExpense(expense)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => deleteExpense(expense.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr className="font-semibold">
                  <td colSpan="3" className="py-3 px-2 text-right">Total Balance:</td>
                  <td className="py-3 px-2 text-right">
                    ${expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
                  </td>
                  {participants.map(p => (
                    <td key={p} className={`py-3 px-2 text-right ${balances[p] > 0 ? 'text-green-600' : balances[p] < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      ${balances[p].toFixed(2)}
                    </td>
                  ))}
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Settlement Summary */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="text-green-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-800">Settlement Summary</h2>
          </div>
          
          {settlements.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 text-lg">🎉 All expenses are settled!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {settlements.map((settlement, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-green-50 rounded-lg border">
                  <div className="flex items-center gap-4">
                    <div className="w-auto px-3 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-red-600 font-semibold text-sm">{settlement.from}</span>
                    </div>
                    <span className="text-gray-600">owes</span>
                    <div className="w-auto px-3 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-semibold text-sm">{settlement.to}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-800">${settlement.amount.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">{settlement.from} → {settlement.to}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpenseSplitter;
