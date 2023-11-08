// https://keepachangelog.com/en/1.1.0/
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml'


// const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

// const version = pkg.version;

const changeLogDir = path.resolve('./changelogs');


fs.mkdirSync(changeLogDir, { recursive: true });

const entries = fs.readdirSync(changeLogDir).map(entry => {

  const fullPath = path.join(changeLogDir, entry);
  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    return fullPath
  }
  return Null
}).filter(entry => entry !== null)


const changelog = { Infos: ["All notable changes to this project will be documented in this file."], Unreleased: [], Versions: {} }

entries.forEach(entry => {
  const fileContent = fs.readFileSync(entry, 'utf8')
  // needs zod validation 
  const changelogItem = yaml.parse(fileContent)
  const { unreleased, type, version, description, issue } = changelogItem
  if (changelogItem.private) return
  const Versions = unreleased ? changelog["Unreleased"] : changelog["Versions"];

  if (!(Versions[version])) {
    Versions[version] = {};
  }

  if (!(type in Versions[version])) {
    Versions[version][type] = []
  }
  const message = `${description}`
  if (issue) {
    message.concat(` (${issue})`);
  }
  Versions[version][type].push(message);
})



// Write file
const outFile = path.resolve('./CHANGELOG.md');
const outStream = fs.createWriteStream(outFile, { encoding: 'utf8' })

outStream.write(`# Changelog\n\n`)

changelog["Infos"]?.forEach(info => {
  outStream.write(`${info}\n\n`)
})




const versions = Object.keys(changelog["Versions"]).sort().reverse();


versions.forEach(version => {
  outStream.write(`## [${version}]\n\n`)
  const Versions = changelog["Versions"];
  const type = "Infos"
  if (changelog["Versions"][version][type]) {
    const messages = changelog["Versions"][version][type];
    messages.forEach(message => {
      outStream.write(`${message}\n`)
    })
    outStream.write(`\n`)
  }

  const types = ["Added", "Fixed", "Removed", "Changed", "Security"]
  types.forEach(type => {
    if (changelog["Versions"][version][type]) {
      const messages = changelog["Versions"][version][type];
      outStream.write(`### ${type}\n\n`)
      messages.forEach(message => {
        outStream.write(`- ${message}\n`)
      })
      outStream.write(`\n`)
    }
  })
})

outStream.end()