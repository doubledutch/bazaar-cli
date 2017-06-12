# New Project Creation
```
> npm install -g bazaar-cli@0.40.11
> cd to-your-development-folder
> bz init project_name # this will create a new project with project_name
Follow the prompts for which sample environments you want set up (mobile, admin, api, etc.)
> cd project_name/mobile
> npm run ios # this will boot the iOS simulator and start the packager
> vi src/home-view.js # edit this file and save, then cmd+R in simulator to reload
```

## If using the Bazaar backend services
```
> vi bazaar.json
Add collections and permissions (documented below) you want created
When finished
> bz publish scheme
```

## Installing to an event
```
> bz install sample-event-id
```

## Publishing binaries
When your changes are ready to go live (update the version in bazaar.json)
```
> bz publish binary
```

# Collection permissions
1. globalReadAccess - any user can read any document (per event) in the collection
2. globalWriteAccess - any user may create/edit any document in the collection
3. userWriteAccess - any user has access to edit any documents assigned to them in the collection
4. By necessity, all users have access to read any documents assigned to them
