const fs = require('fs');
const path = require('path');

const filePath = 'd:\\2026\\saiid\\saiid-client\\src\\resources\\admin\\orphan-groupings\\advanced.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const startMarker = '                      {/* Expandable orphan rows */}';
const endMarker = '                    </React.Fragment>';

const startIndex = content.indexOf(startMarker);
// We want to find the NEXT </React.Fragment> after the start marker that is followed by </tbody>
const endSearchStart = startIndex + startMarker.length;
let endIndex = -1;

let searchIndex = endSearchStart;
while (true) {
    const foundEnd = content.indexOf(endMarker, searchIndex);
    if (foundEnd === -1) break;
    
    const afterEnd = content.substring(foundEnd + endMarker.length, foundEnd + endMarker.length + 100);
    if (afterEnd.includes('</tbody>')) {
        endIndex = foundEnd + endMarker.length;
        break;
    }
    searchIndex = foundEnd + 1;
}

if (startIndex !== -1 && endIndex !== -1) {
    const replacement = `                      {/* Expandable orphan rows */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="6" className="px-6 py-4 bg-blue-50/50">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                  <Users className="w-4 h-4 text-blue-500" />
                                  الأيتام في المجموعة ({orphansList.length})
                                </h4>
                                
                                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                                  <button 
                                    onClick={() => setGroupViewModes(prev => ({ ...prev, [grouping.id]: 'table' }))}
                                    className={\`p-1.5 rounded-md transition-all \${groupViewModes[grouping.id] !== 'cards' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}\`}
                                    title="عرض جدول"
                                  >
                                    <List className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => setGroupViewModes(prev => ({ ...prev, [grouping.id]: 'cards' }))}
                                    className={\`p-1.5 rounded-md transition-all \${groupViewModes[grouping.id] === 'cards' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}\`}
                                    title="عرض بطاقات"
                                  >
                                    <LayoutGrid className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {isLoadingThis ? (
                                <div className="text-center py-8">
                                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
                                  <p className="text-sm text-gray-500">جاري تحميل الأيتام...</p>
                                </div>
                              ) : orphansList.length > 0 ? (
                                groupViewModes[grouping.id] === 'cards' ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {orphansList.map((orphan, idx) => (
                                      <div 
                                        key={orphan.orphan_id_number || orphan.id || idx} 
                                        className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                                      >
                                        <div className="flex items-start justify-between">
                                          <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-gray-900">
                                              {orphan.orphan_full_name || orphan.name || 'غير معروف'}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                              الهوية: {orphan.orphan_id_number || orphan.id_number || '-'}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                              <MapPin className="w-3 h-3 flex-shrink-0 text-gray-400" />
                                              <span className="truncate">{orphan.current_address || orphan.address || '-'}</span>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5">
                                              الجنس: {orphan.orphan_gender || orphan.gender || '-'}
                                            </div>
                                            {(orphan.orphan_birth_date || orphan.birth_date) && (
                                              <div className="text-xs text-gray-500 mt-0.5">
                                                تاريخ الميلاد: {orphan.orphan_birth_date || orphan.birth_date}
                                              </div>
                                            )}
                                            {orphan.sponsored_projects?.length > 0 && (
                                              <div className="text-xs font-bold text-green-600 mt-1 flex items-center gap-1">
                                                <Heart className="w-3 h-3" />
                                                مبلغ الكفالة: \${orphan.sponsored_projects[0].pivot.sponsorship_amount} $
                                              </div>
                                            )}
                                            <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100">
                                              <button
                                                type="button"
                                                onClick={() => handleDownloadPdf(orphan.orphan_id_number || orphan.id_number)}
                                                className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded text-[10px] font-bold hover:bg-red-100 transition-colors"
                                                title="تحميل PDF"
                                              >
                                                <FileText className="w-3 h-3" />
                                                PDF
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDownloadWord(orphan.orphan_id_number || orphan.id_number)}
                                                className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-[10px] font-bold hover:bg-blue-100 transition-colors"
                                                title="تحميل Word"
                                              >
                                                <FileSpreadsheet className="w-3 h-3" />
                                                Word
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveOrphanFromGroup(grouping.id, orphan.orphan_id_number || orphan.id_number)}
                                                className="flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-600 rounded text-[10px] font-bold hover:bg-gray-100 transition-colors border border-gray-100"
                                                title="إزالة من المجموعة"
                                              >
                                                <UserMinus className="w-3 h-3" />
                                                إزالة
                                              </button>
                                            </div>
                                          </div>
                                          <div className="flex flex-wrap gap-1.5 mr-2 flex-shrink-0">
                                            {sponsoredOrphans.has(orphan.orphan_id_number || orphan.id_number || orphan.id) && (
                                              <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">مكفول</span>
                                            )}
                                            {orphan.is_mother_deceased === 'نعم' && (
                                              <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">الأم متوفاة</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden overflow-x-auto">
                                    <table className="w-full text-sm text-right">
                                      <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                                        <tr>
                                          <th className="px-4 py-3 min-w-[200px]">اسم اليتيم</th>
                                          <th className="px-4 py-3">رقم الهوية</th>
                                          <th className="px-4 py-3 text-center">الجنس</th>
                                          <th className="px-4 py-3">الموقع</th>
                                          <th className="px-4 py-3 text-center">مبلغ الكفالة</th>
                                          <th className="px-4 py-3">الإجراءات</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {orphansList.map((orphan, idx) => (
                                          <tr key={orphan.orphan_id_number || orphan.id || idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3">
                                              <div className="font-semibold text-gray-900">{orphan.orphan_full_name || orphan.name}</div>
                                              <div className="text-[10px] flex flex-wrap gap-1 mt-1">
                                                {sponsoredOrphans.has(orphan.orphan_id_number || orphan.id_number || orphan.id) && (
                                                  <span className="text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">مكفول</span>
                                                )}
                                                {orphan.is_mother_deceased === 'نعم' && (
                                                  <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">الأم متوفاة</span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                                              {orphan.orphan_id_number || orphan.id_number || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center text-gray-600">
                                              {orphan.orphan_gender || orphan.gender || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                              <div className="flex items-center gap-1 max-w-[200px] truncate">
                                                <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                <span className="truncate">{orphan.current_address || '-'}</span>
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-green-600">
                                              {orphan.sponsored_projects?.length > 0 
                                                ? \`\${orphan.sponsored_projects[0].pivot.sponsorship_amount} $\`
                                                : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                              <div className="flex gap-1">
                                                <button type="button" onClick={() => handleDownloadPdf(orphan.orphan_id_number || orphan.id_number)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="PDF"><FileText className="w-3.5 h-3.5" /></button>
                                                <button type="button" onClick={() => handleDownloadWord(orphan.orphan_id_number || orphan.id_number)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Word"><FileSpreadsheet className="w-3.5 h-3.5" /></button>
                                                <button type="button" onClick={() => handleRemoveOrphanFromGroup(grouping.id, orphan.orphan_id_number || orphan.id_number)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="إزالة"><UserMinus className="w-3.5 h-3.5" /></button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )
                              ) : (
                                <div className="text-center py-8">
                                  <UserX className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                  <p className="text-sm text-gray-500 font-medium">لا توجد أيتام في هذه المجموعة</p>
                                  <p className="text-xs text-gray-400 mt-1">يمكنك إضافة أيتام بالضغط على زر الإضافة</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>`;
    
    const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Successfully fixed advanced.jsx');
} else {
    console.error('Markers not found', { startIndex, endIndex });
    process.exit(1);
}
