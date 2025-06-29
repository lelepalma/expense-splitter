import React, { useState, useMemo, useEffect, useCallback } from 'react'; // Added useCallback
import { Plus, Edit2, Trash2, Users, Download, Upload, Calculator, LogOut, Save, FileUp } from 'lucide-react'; // Removed LogIn
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // Corrected import
// import { gapi } from 'gapi-script'; // Removed gapi-script import

// Placeholder for Google OAuth Client ID
const GOOGLE_OAUTH_CLIENT_ID = "YOUR_CLIENT_ID_HERE";
// const API_KEY = "YOUR_API_KEY_HERE"; // Removed API_KEY
// Note: DISCOVERY_DOCS for sheets is not strictly needed if only using Drive.
// However, if both are intended, list them:
// const DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4", "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
// const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]; // Commented out DISCOVERY_DOCS
const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file"; // Added Drive scope, now uncommented

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

  // --- Google API Functions --- (Old GAPI functions will be removed or refactored)

  const handleSignInWithGoogleCallback = (response) => {
    console.log('ID Token response:', response);
    // For now, just log clientId and credential. Proper decoding of response.credential (JWT) is needed for full user info.
    console.log('Client ID:', response.clientId);
    console.log('Credential (JWT):', response.credential);

    setIsAuthenticated(true);
    // Placeholder user info until JWT is decoded or another method is used
    setUserInfo({ name: 'User (GIS)', email: 'user@example.com (GIS)' }); // Basic user info from ID token
    setExportStatus('✅ ID Token received. Requesting Access Token...');

    // After getting the ID token, request an access token
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          setGisAccessToken(tokenResponse.access_token);
          setExportStatus('✅ Access Token obtained!');
          console.log('Access Token:', tokenResponse.access_token);
          // TODO: Optionally, decode ID token (response.credential) here for more user info if needed
          // For example: const decodedIdToken = jwt_decode(response.credential); setUserInfo({name: decodedIdToken.name, email: decodedIdToken.email, imageUrl: decodedIdToken.picture});
        } else {
          setExportStatus('❌ Failed to obtain Access Token.');
          console.error('Failed to obtain access token', tokenResponse);
        }
        setTimeout(() => setExportStatus(''), 5000); // Longer display for token status
      },
      error_callback: (error) => {
        console.error('Access Token Error:', error);
        setExportStatus(`❌ Access Token Error: ${error.type || error.message || 'Unknown error'}`);
        setTimeout(() => setExportStatus(''), 5000);
      }
    });
    tokenClient.requestAccessToken();
  };

  useEffect(() => {
    const initializeGis = () => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        console.log('GIS client found, initializing...');
        window.google.accounts.id.initialize({
          client_id: GOOGLE_OAUTH_CLIENT_ID,
          callback: handleSignInWithGoogleCallback,
        });
        console.log('GIS initialized.');
        // Ensure the signInDiv is present in the DOM when this runs
        const signInButtonContainer = document.getElementById('signInDiv');
        if (signInButtonContainer) {
            window.google.accounts.id.renderButton(
                signInButtonContainer,
                { theme: 'outline', size: 'large', type: 'standard', text: 'signin_with' }
            );
            console.log('GIS Sign-In button rendered.');
        } else {
            console.error('signInDiv not found for GIS button rendering.');
        }
      } else {
        console.warn('GIS client not ready yet, retrying in 500ms...');
        setTimeout(initializeGis, 500);
      }
    };
    initializeGis();
  }, []); // Empty dependency array to run once on mount. handleSignInWithGoogleCallback should be memoized if defined in component scope and used here.

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

              {/* Group 2: Manual File Operations */}
              <button
                onClick={() => document.getElementById('import-file').click()}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors text-gray-700"
              >
                <Upload size={18} />
                Upload JSON
              </button>
              <button
                onClick={handleDownloadJson}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors text-gray-700"
              >
                <Download size={18} />
                Download JSON
              </button>

              {/* Group 3: Google Drive Operations (Conditional on Authentication) */}
              {isAuthenticated && (
                <>
                  <button
                    onClick={handleSaveToDrive}
                    disabled={isSavingToDrive || isLoadingFromDrive || !gisAccessToken}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors"
                  >
                    <Save size={18} />
                    {isSavingToDrive ? 'Saving...' : 'Save to Drive'}
                  </button>
                  <button
                    onClick={handleLoadFromDrive}
                    disabled={isLoadingFromDrive || isSavingToDrive || !gisAccessToken}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
                  >
                    <FileUp size={18} />
                    {isLoadingFromDrive ? 'Loading...' : 'Load from Drive'}
                  </button>
                </>
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
