<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProjectProposalImage extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_proposal_id',
        'image_path',
        'display_order',
        'type',
    ];

    protected $casts = [
        'display_order' => 'integer',
        'type' => 'string',
    ];

    /**
     * Get the project proposal that owns this image
     */
    public function projectProposal()
    {
        return $this->belongsTo(ProjectProposal::class);
    }

    /**
     * Get the image URL
     */
    public function getImageUrlAttribute()
    {
        if (!$this->image_path) {
            return null;
        }

        // If it's already a full URL, return it
        if (str_starts_with($this->image_path, 'http://') || 
            str_starts_with($this->image_path, 'https://')) {
            return $this->image_path;
        }

        // Get base URL
        try {
            $baseUrl = request()->getSchemeAndHttpHost();
            if (str_contains($baseUrl, 'localhost') && !str_contains($baseUrl, ':')) {
                $baseUrl = str_replace('localhost', 'localhost:8000', $baseUrl);
            }
        } catch (\Exception $e) {
            $baseUrl = config('app.url', 'http://localhost:8000');
        }

        return rtrim($baseUrl, '/') . '/' . ltrim($this->image_path, '/');
    }
}
