import { ChevronDown, ChevronUp, Palette, User } from 'lucide-react';
import PillTagInput from './PillTagInput';
import { BODY_TYPES } from '../../lib/constants/DERE_PRESETS';

export default function AppearanceForm({
  isExpanded,
  onToggle,
  appearanceData,
  onChange,
  disabled = false,
}) {
  const handleFieldChange = (field, value) => {
    onChange({
      ...appearanceData,
      [field]: value,
    });
  };

  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/50 hover:bg-gray-800 transition-colors text-white"
      >
        <span className="flex items-center gap-2">
          <User className="w-5 h-5 text-indigo-400" />
          <span className="font-medium">+ Add Detailed Appearance</span>
        </span>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 space-y-6 bg-gray-900/30">
          {/* Body & Structure */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Body & Structure</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="body-type" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Body Type
                </label>
                <select
                  id="body-type"
                  value={appearanceData.body_type || ''}
                  onChange={(e) => handleFieldChange('body_type', e.target.value)}
                  disabled={disabled}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="">Select...</option>
                  {BODY_TYPES.map(type => (
                    <option key={type} value={type.toLowerCase()}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="height" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Height Descriptor
                </label>
                <input
                  id="height"
                  type="text"
                  value={appearanceData.height_descriptor || ''}
                  onChange={(e) => handleFieldChange('height_descriptor', e.target.value)}
                  placeholder="e.g., tall, short, 5'9&quot;"
                  disabled={disabled}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label htmlFor="skin-tone" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Skin Tone
                </label>
                <input
                  id="skin-tone"
                  type="text"
                  value={appearanceData.skin_tone || ''}
                  onChange={(e) => handleFieldChange('skin_tone', e.target.value)}
                  placeholder="e.g., pale, tan, dark..."
                  disabled={disabled}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>
            </div>
          </section>

          {/* Hair & Eyes */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Hair & Eyes</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <PillTagInput
                  id="hair-color"
                  label="Hair Color"
                  value={appearanceData.hair_color || []}
                  onChange={(colors) => handleFieldChange('hair_color', colors)}
                  placeholder="e.g., silver, black with blue highlights..."
                  disabled={disabled}
                />
              </div>

              <div>
                <label htmlFor="hair-style" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Hair Style
                </label>
                <input
                  id="hair-style"
                  type="text"
                  value={appearanceData.hair_style || ''}
                  onChange={(e) => handleFieldChange('hair_style', e.target.value)}
                  placeholder="e.g., long wavy ponytail, short undercut..."
                  disabled={disabled}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>

              <div>
                <PillTagInput
                  id="eye-color"
                  label="Eye Color"
                  value={appearanceData.eye_color || []}
                  onChange={(colors) => handleFieldChange('eye_color', colors)}
                  placeholder="e.g., emerald green, heterochromia..."
                  disabled={disabled}
                />
              </div>

              <div>
                <label htmlFor="eye-shape" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Eye Shape
                </label>
                <input
                  id="eye-shape"
                  type="text"
                  value={appearanceData.eye_shape || ''}
                  onChange={(e) => handleFieldChange('eye_shape', e.target.value)}
                  placeholder="e.g., almond-shaped, wide innocent eyes..."
                  disabled={disabled}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>
            </div>
          </section>

          {/* Facial Features */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Facial Features</h3>
            
            <PillTagInput
              id="facial-features"
              label="Facial Features"
              value={appearanceData.facial_features || []}
              onChange={(features) => handleFieldChange('facial_features', features)}
              placeholder="e.g., freckles, sharp jaw, dimples, scar on left cheek..."
              disabled={disabled}
            />
          </section>

          {/* Clothing & Accessories */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Palette className="w-5 h-5 text-indigo-400" />
              Clothing & Accessories
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="clothing-style" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Clothing Style
                </label>
                <input
                  id="clothing-style"
                  type="text"
                  value={appearanceData.clothing_style || ''}
                  onChange={(e) => handleFieldChange('clothing_style', e.target.value)}
                  placeholder="e.g., gothic lolita, business casual..."
                  disabled={disabled}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label htmlFor="art-style" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Art Style Reference
                </label>
                <input
                  id="art-style"
                  type="text"
                  value={appearanceData.art_style_reference || ''}
                  onChange={(e) => handleFieldChange('art_style_reference', e.target.value)}
                  placeholder="e.g., Studio Ghibli, shounen manga, painterly..."
                  disabled={disabled}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label htmlFor="signature-outfit" className="block text-sm font-medium text-gray-300 mb-1.5">
                Signature Outfit
              </label>
              <textarea
                id="signature-outfit"
                value={appearanceData.signature_outfit || ''}
                onChange={(e) => handleFieldChange('signature_outfit', e.target.value)}
                placeholder="Detailed description of their most recognizable outfit..."
                rows={3}
                disabled={disabled}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PillTagInput
                id="accessories"
                label="Accessories"
                value={appearanceData.accessories || []}
                onChange={(items) => handleFieldChange('accessories', items)}
                placeholder="e.g., guitar, bandanna, oversized glasses..."
                disabled={disabled}
              />
              
              <PillTagInput
                id="props"
                label="Props"
                value={appearanceData.props || []}
                onChange={(items) => handleFieldChange('props', items)}
                placeholder="Items typically shown with the character..."
                disabled={disabled}
              />
            </div>
          </section>

          {/* Visual Motifs */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Visual Motifs</h3>
            
            <PillTagInput
              id="visual-motifs"
              label="Visual Motifs"
              value={appearanceData.visual_motifs || []}
              onChange={(motifs) => handleFieldChange('visual_motifs', motifs)}
              placeholder="Symbolic recurring elements: roses, chains, stars..."
              disabled={disabled}
            />
          </section>
        </div>
      )}
    </div>
  );
}
