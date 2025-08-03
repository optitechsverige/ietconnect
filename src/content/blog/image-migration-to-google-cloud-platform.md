---
title: 'Image Migration to Google Cloud Platform'
description: 'Learn how we successfully migrated our entire image infrastructure from multiple environments to Google Cloud Platform in one and a half years.'
pubDate: 'May 14, 2024'
updatedDate: 'May 14, 2024'
heroImage: '/blog-placeholder-3.jpg'
author: 'Praneeth Peiris'
authorBio: 'I want to change the world!'
authorTwitter: '@praneethpeiris'
authorGithub: 'praneethpeiris'
authorLinkedin: 'praneethpeiris'
category: 'Backend'
tags: ['google cloud', 'architecture', 'backend', 'migration', 'infrastructure']
keywords: 'google cloud platform, image migration, cloud infrastructure, backend architecture, gcp migration'
canonical: 'https://ietconnect.com/blog/image-migration-to-google-cloud-platform'
ogImage: '/blog-placeholder-3.jpg'
ogType: 'article'
readTime: '22 min read'
---

Any type of software project can be difficult especially when it's a massive migration project. We were able to move all our image infrastructure from multiple environments to GCP in one and a half years. The most important thing we learned is to plan properly and try our best to stick to it.

## Background

At trivago, we handle millions of images daily for our hotel search platform. Our image infrastructure was spread across multiple environments and cloud providers, making it increasingly difficult to maintain, scale, and optimize. The decision to migrate everything to Google Cloud Platform (GCP) was driven by several factors:

- **Consistency**: Having all image infrastructure in one place
- **Performance**: Better global distribution and caching
- **Cost optimization**: More predictable pricing models
- **Scalability**: Easier to scale with growing demand
- **Maintenance**: Simplified operations and monitoring

## The Challenge

The migration wasn't just about moving files from one place to another. We had to consider:

### Technical Challenges

- **Scale**: Petabytes of image data across multiple regions
- **Availability**: Zero downtime during migration
- **Performance**: Maintaining or improving image load times
- **Consistency**: Ensuring data integrity throughout the process
- **Legacy systems**: Updating all services that reference images

### Organizational Challenges

- **Team coordination**: Multiple teams working on different aspects
- **Timeline pressure**: Business requirements and deadlines
- **Resource allocation**: Balancing migration work with feature development
- **Risk management**: Minimizing impact on user experience

## Planning Phase

### Assessment and Inventory

The first step was to understand exactly what we were working with:

```bash
# Example script to inventory image assets
#!/bin/bash
for environment in prod staging dev; do
    echo "Scanning $environment..."
    aws s3 ls s3://images-$environment --recursive --summarize
done
```

We discovered:
- **15+ different storage locations** across AWS, Azure, and on-premise
- **2.3 petabytes** of image data
- **500+ million individual files**
- **12 different image formats** and sizes
- **Complex naming conventions** that had evolved over time

### Architecture Design

We designed a new architecture that would:

1. **Centralize storage** in Google Cloud Storage
2. **Implement CDN** using Cloud CDN for global distribution
3. **Automate processing** with Cloud Functions for image optimization
4. **Monitor everything** with Cloud Monitoring and custom dashboards

```yaml
# Infrastructure as Code example
resources:
  - name: images-bucket
    type: storage.v1.bucket
    properties:
      location: US
      storageClass: STANDARD
      versioning:
        enabled: true
      lifecycle:
        rule:
          - action:
              type: SetStorageClass
              storageClass: NEARLINE
            condition:
              age: 30
```

### Migration Strategy

We decided on a **phased approach**:

1. **Phase 1**: Set up new infrastructure (2 months)
2. **Phase 2**: Migrate non-critical images (4 months)
3. **Phase 3**: Migrate production images (6 months)
4. **Phase 4**: Decommission old infrastructure (6 months)

## Implementation

### Phase 1: Infrastructure Setup

Setting up the foundation was crucial. We used Terraform to manage infrastructure as code:

```hcl
resource "google_storage_bucket" "images" {
  name     = "trivago-images-prod"
  location = "US"
  
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
  
  versioning {
    enabled = true
  }
}

resource "google_compute_backend_bucket" "images_backend" {
  name        = "images-backend"
  bucket_name = google_storage_bucket.images.name
  enable_cdn  = true
}
```

### Phase 2: Data Migration Pipeline

We built a robust pipeline to handle the massive data transfer:

```python
import asyncio
from google.cloud import storage
from concurrent.futures import ThreadPoolExecutor

class ImageMigrator:
    def __init__(self, source_bucket, dest_bucket):
        self.source = source_bucket
        self.dest = dest_bucket
        self.client = storage.Client()
        
    async def migrate_batch(self, image_list):
        """Migrate a batch of images asynchronously"""
        with ThreadPoolExecutor(max_workers=10) as executor:
            tasks = [
                executor.submit(self.migrate_single_image, img)
                for img in image_list
            ]
            
            for task in asyncio.as_completed(tasks):
                result = await task
                if result['success']:
                    self.log_success(result['image'])
                else:
                    self.log_error(result['image'], result['error'])
    
    def migrate_single_image(self, image_path):
        """Migrate a single image with retry logic"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # Download from source
                source_blob = self.source.blob(image_path)
                image_data = source_blob.download_as_bytes()
                
                # Upload to destination
                dest_blob = self.dest.blob(image_path)
                dest_blob.upload_from_string(image_data)
                
                # Verify integrity
                if self.verify_integrity(source_blob, dest_blob):
                    return {'success': True, 'image': image_path}
                    
            except Exception as e:
                if attempt == max_retries - 1:
                    return {'success': False, 'image': image_path, 'error': str(e)}
                time.sleep(2 ** attempt)  # Exponential backoff
```

### Phase 3: Service Updates

Updating all services to use the new image URLs was a massive undertaking:

```javascript
// Image URL transformation service
class ImageUrlTransformer {
    constructor() {
        this.oldDomains = [
            'images.trivago.com',
            'static.trivago.net',
            'cdn.trivago.eu'
        ];
        this.newDomain = 'images.gcp.trivago.com';
    }
    
    transformUrl(oldUrl) {
        for (const domain of this.oldDomains) {
            if (oldUrl.includes(domain)) {
                return oldUrl.replace(domain, this.newDomain);
            }
        }
        return oldUrl;
    }
    
    // Batch transform for database updates
    async transformBatch(imageRecords) {
        const updates = imageRecords.map(record => ({
            id: record.id,
            old_url: record.image_url,
            new_url: this.transformUrl(record.image_url)
        }));
        
        return this.database.batchUpdate(updates);
    }
}
```

## Monitoring and Validation

Throughout the migration, monitoring was essential:

### Custom Dashboards

We created comprehensive dashboards to track:
- **Migration progress** (files transferred per hour)
- **Error rates** (failed transfers, retries)
- **Performance metrics** (image load times, CDN hit rates)
- **Cost tracking** (storage costs, bandwidth usage)

```sql
-- Query to track migration progress
SELECT 
    DATE(created_at) as migration_date,
    COUNT(*) as images_migrated,
    SUM(file_size_bytes) as total_bytes,
    AVG(transfer_time_ms) as avg_transfer_time
FROM migration_log 
WHERE status = 'SUCCESS'
GROUP BY DATE(created_at)
ORDER BY migration_date;
```

### Automated Testing

We implemented automated tests to ensure image availability:

```python
import requests
import concurrent.futures
from urllib.parse import urlparse

class ImageValidator:
    def __init__(self, test_urls):
        self.test_urls = test_urls
        self.session = requests.Session()
        
    def validate_image(self, url):
        """Validate that an image is accessible and loads correctly"""
        try:
            response = self.session.head(url, timeout=10)
            return {
                'url': url,
                'status_code': response.status_code,
                'success': response.status_code == 200,
                'response_time': response.elapsed.total_seconds()
            }
        except Exception as e:
            return {
                'url': url,
                'success': False,
                'error': str(e)
            }
    
    def validate_batch(self, batch_size=50):
        """Validate images in parallel batches"""
        results = []
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=batch_size) as executor:
            future_to_url = {
                executor.submit(self.validate_image, url): url 
                for url in self.test_urls
            }
            
            for future in concurrent.futures.as_completed(future_to_url):
                result = future.result()
                results.append(result)
                
        return results
```

## Challenges and Solutions

### Challenge 1: Zero Downtime Requirement

**Problem**: We couldn't afford any downtime during the migration.

**Solution**: Implemented a dual-serving approach where images were served from both old and new locations during the transition period.

```nginx
# Nginx configuration for fallback serving
location /images/ {
    try_files $uri @new_images;
}

location @new_images {
    proxy_pass https://images.gcp.trivago.com;
    proxy_intercept_errors on;
    error_page 404 = @old_images;
}

location @old_images {
    proxy_pass https://legacy-images.trivago.com;
}
```

### Challenge 2: Data Consistency

**Problem**: Ensuring all images were transferred correctly without corruption.

**Solution**: Implemented checksum validation for every transferred file.

```python
import hashlib

def calculate_checksum(file_path):
    """Calculate MD5 checksum of a file"""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def verify_transfer(source_path, dest_path):
    """Verify that transfer was successful"""
    source_checksum = calculate_checksum(source_path)
    dest_checksum = calculate_checksum(dest_path)
    return source_checksum == dest_checksum
```

### Challenge 3: Performance Optimization

**Problem**: Maintaining image load performance during and after migration.

**Solution**: Implemented aggressive caching and image optimization.

```python
from PIL import Image
import io

class ImageOptimizer:
    def __init__(self):
        self.formats = {
            'webp': {'quality': 85, 'method': 6},
            'jpeg': {'quality': 85, 'optimize': True},
            'png': {'optimize': True}
        }
    
    def optimize_image(self, image_data, target_format='webp'):
        """Optimize image for web delivery"""
        img = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB if necessary
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')
        
        # Resize if too large
        max_size = (2048, 2048)
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Save with optimization
        output = io.BytesIO()
        save_kwargs = self.formats.get(target_format, {})
        img.save(output, format=target_format.upper(), **save_kwargs)
        
        return output.getvalue()
```

## Results and Impact

### Performance Improvements

After completing the migration, we saw significant improvements:

- **40% faster image load times** globally
- **60% reduction in CDN costs** due to better caching
- **99.9% uptime** maintained throughout the migration
- **50% reduction in storage costs** with intelligent tiering

### Operational Benefits

- **Unified monitoring** across all image infrastructure
- **Simplified deployment** process for image-related features
- **Better disaster recovery** with automated backups
- **Improved security** with centralized access controls

### Team Learning

The project taught us valuable lessons about:

- **Planning**: The importance of thorough upfront planning
- **Communication**: Regular updates and clear documentation
- **Risk management**: Having rollback plans for every phase
- **Automation**: Investing in tooling pays off in large projects

## Lessons Learned

### Plan ahead, properly

In most cases, due to many internal and external factors, we might have to do a "quick fix" when doing software projects. However, after looking back at our migration project, it's evident that spending a little bit more time to understand the requirements properly before implementing can serve us better in the long run. If we hadn't done so, we would have ended up with yet another unfinished migration.

It's also important to keep the team motivated especially when the project lasts longer. Celebrating milestones, giving recognition to people, and planning everyone's vacation accordingly helped a lot to keep a positive atmosphere in the team.

### Mutual Agreements

Working with diverse people allows us to embrace their strengths and help them overcome their weaknesses. It also enables people to take charge of what they're good at and help others to get on board. These differences should be identified as early as possible and agreed upon among the members. This also helps to have standards for our work and the processes that ultimately make our software better.

### Document Everything

No one can remember everything they hear or tell. It's especially true when someone has to switch between different types of work over a long period. That's why documenting everything becomes a lifesaver. We won't have to remember everything and can always refer to the documents to get more context. These documents also act as a reality check for the team to know whether they are doing the right thing.

Keeping everything well-documented is one of the top reasons this project was a success!

## Key Learnings

This project helped us learn a lot of things throughout its course: not only about tech but also about people.

### Plan ahead, properly

In most cases, due to many internal and external factors, we might have to do a "quick fix" when doing software projects. However, after looking back at our migration project, it's evident that spending a little bit more time to understand the requirements properly before implementing can serve us better in the long run. If we hadn't done so, we would have ended up with yet another unfinished migration.

It's also important to keep the team motivated especially when the project lasts longer. Celebrating milestones, giving recognition to people, and planning everyone's vacation accordingly helped a lot to keep a positive atmosphere in the team.

### Mutual Agreements

Working with diverse people allows us to embrace their strengths and help them overcome their weaknesses. It also enables people to take charge of what they're good at and help others to get on board. These differences should be identified as early as possible and agreed upon among the members. This also helps to have standards for our work and the processes that ultimately make our software better.

### Document Everything

No one can remember everything they hear or tell. It's especially true when someone has to switch between different types of work over a long period. That's why documenting everything becomes a lifesaver. We won't have to remember everything and can always refer to the documents to get more context. These documents also act as a reality check for the team to know whether they are doing the right thing.

## Summary

Any type of software project can be difficult especially when it's a massive migration project. We were able to move all our image infrastructure from multiple environments to GCP in one and a half years. The most important thing we learned is to plan properly and try our best to stick to it. If things change along the way, adhere to it and change the plan accordingly.

If we fail to plan, we plan to fail.
