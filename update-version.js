#!/usr/bin/env node

/**
 * Auto-update version following format: YEAR.WEEK.DEPLOYMENT
 * Example: 25.48.1 (2025, Week 48, 1st deployment)
 * Run this before deployment: node update-version.js
 */

const fs = require('fs');
const path = require('path');

// Get current week number
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Calculate new version
function calculateNewVersion() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // e.g., "25"
  const week = getWeekNumber(now); // e.g., 48
  
  // Read current version from VERSION file
  const versionFile = path.join(__dirname, 'VERSION');
  let currentVersion = '25.48.0'; // Default fallback
  
  if (fs.existsSync(versionFile)) {
    currentVersion = fs.readFileSync(versionFile, 'utf8').trim();
  }
  
  // Parse current version
  const [currentYear, currentWeek, currentDeployment] = currentVersion.split('.').map(Number);
  
  let newDeployment;
  if (currentYear === parseInt(year) && currentWeek === week) {
    // Same week - increment deployment number
    newDeployment = currentDeployment + 1;
  } else {
    // New week - reset to 1
    newDeployment = 1;
  }
  
  return {
    version: `${year}.${week}.${newDeployment}`,
    year,
    week,
    deployment: newDeployment,
    wasIncremented: currentYear === parseInt(year) && currentWeek === week
  };
}

// Main execution
console.log('🚀 Budget Tracker Version Update');
console.log('='.repeat(50));

// Generate timestamp and new version
const timestamp = new Date().toISOString();
const versionInfo = calculateNewVersion();

console.log(`📅 Current Week: Week ${versionInfo.week}, 20${versionInfo.year}`);
console.log(`🔢 Deployment #${versionInfo.deployment} this week`);
console.log(`📦 New Version: v${versionInfo.version}`);
console.log(`🕐 Build Time: ${timestamp}`);
console.log('');

// Update VERSION file
const versionFile = path.join(__dirname, 'VERSION');
try {
  fs.writeFileSync(versionFile, versionInfo.version, 'utf8');
  console.log(`✅ Updated VERSION file`);
} catch (error) {
  console.error(`❌ Error updating VERSION file:`, error.message);
  process.exit(1);
}

// Files to update
const filesToUpdate = [
  { 
    file: 'script.js', 
    patterns: [
      { 
        pattern: /const BUILD_TIMESTAMP = '[^']+';/,
        replacement: `const BUILD_TIMESTAMP = '${timestamp}';`
      },
      {
        pattern: /const APP_VERSION = '[^']*';/,
        replacement: `const APP_VERSION = '${versionInfo.version}';`
      }
    ]
  },
  { 
    file: 'service-worker.js', 
    patterns: [
      { 
        pattern: /const BUILD_TIMESTAMP = '[^']+';/,
        replacement: `const BUILD_TIMESTAMP = '${timestamp}';`
      }
    ]
  }
];

let updated = 0;
let errors = 0;

filesToUpdate.forEach(({ file, patterns }) => {
  const filePath = path.join(__dirname, file);
  
  try {
    // Read file
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Apply all patterns
    patterns.forEach(({ pattern, replacement }) => {
      if (!pattern.test(content)) {
        console.log(`⚠️  Warning: Pattern not found in ${file}`);
        return;
      }
      content = content.replace(pattern, replacement);
    });
    
    // Write back
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated ${file}`);
    updated++;
    
  } catch (error) {
    console.error(`❌ Error updating ${file}:`, error.message);
    errors++;
  }
});

console.log('\n' + '='.repeat(50));
console.log(`📊 Summary: ${updated + 1} files updated, ${errors} errors`);

if (errors === 0) {
  console.log(`\n🎉 Version updated to: v${versionInfo.version}`);
  console.log('✨ Ready to commit and deploy!');
  console.log('\nNext steps:');
  console.log('  git add .');
  console.log(`  git commit -m "Deploy v${versionInfo.version}"`);
  console.log('  git push origin main');
  process.exit(0);
} else {
  console.log('\n⚠️  Some files failed to update. Please check errors above.');
  process.exit(1);
}

