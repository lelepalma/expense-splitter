import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Users, Download, Upload, Calculator } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // Corrected import

const ExpenseSplitter = () => {
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

  const exportToPdf = async () => {
    setExportStatus('Exporting...');
    try {
      const doc = new jsPDF();

      // Expenses Ledger Table
      const expenseHeaders = ["Date", "Payee", "Description", "Amount", ...participants];
      const expenseRows = expenses.map(expense => {
        const row = [
          expense.date,
          expense.payee,
          expense.description,
          expense.amount.toFixed(2),
        ];
        participants.forEach(p => {
          const splitAmount = expense.splits[p];
          if (splitAmount !== undefined) {
            row.push(splitAmount.toFixed(2));
          } else {
            // If a participant was added after an expense, they might not be in its splits
            // Or if the expense was not split with them
            row.push('0.00');
          }
        });
        return row;
      });

      doc.autoTable({
        head: [expenseHeaders],
        body: expenseRows,
        startY: 20,
        headStyles: { fillColor: [79, 70, 229] }, // Indigo color for header
        styles: { fontSize: 8 },
        columnStyles: {
          3: { halign: 'right' }, // Amount column
           // Align participant split amounts to the right
          ...Object.fromEntries(participants.map((_, i) => [4 + i, { halign: 'right' }]))
        }
      });

      // Settlement Summary Table
      if (settlements.length > 0) {
        const settlementHeaders = ["From", "To", "Amount"];
        const settlementRows = settlements.map(settlement => [
          settlement.from,
          settlement.to,
          settlement.amount.toFixed(2)
        ]);

        doc.autoTable({
          head: [settlementHeaders],
          body: settlementRows,
          startY: doc.lastAutoTable.finalY + 10,
          headStyles: { fillColor: [22, 163, 74] }, // Green color for header
          styles: { fontSize: 8 },
          columnStyles: {
            2: { halign: 'right' } // Amount column
          }
        });
      } else {
        doc.text("No settlements needed - everyone is even!", 14, doc.lastAutoTable.finalY + 10);
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
            alert('Data imported successfully!');
          } else {
            throw new Error('Invalid file structure');
          }
        } catch (error) {
          console.error('Import failed:', error);
          alert('Invalid file format. Please select a valid expense splitter JSON file.');
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
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => document.getElementById('import-file').click()}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Upload size={18} />
                Import
              </button>
              <button
                onClick={exportToPdf}
                disabled={exportStatus === 'Exporting...'}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg transition-colors"
              >
                <Download size={18} />
                Export PDF
              </button>
              {exportStatus && (
                <div className={`flex items-center px-3 py-2 rounded-lg text-sm ${
                  exportStatus.startsWith('✅') ? 'bg-green-100 text-green-800' :
                  exportStatus.startsWith('❌') ? 'bg-red-100 text-red-800' :
                  'bg-blue-100 text-blue-800' // For 'Exporting...'
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
