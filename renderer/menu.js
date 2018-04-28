exports.createMenu = function(remote, ipcRenderer) {
  const { Menu } = remote;
  const template = [
      {
        label: 'Edit',
        submenu: [
          {role: 'about'},
          {type: 'separator'},
          {role: 'services', submenu: []},
          {type: 'separator'},
          {role: 'hide'},
          {role: 'hideothers'},
          {role: 'unhide'},
          {type: 'separator'},
          {role: 'quit'}
        ]
      },
      {
        label: 'View',
        submenu: [
          {role: 'reload'},
          {role: 'forcereload'},
          {role: 'toggledevtools'},
          {type: 'separator'},
          {role: 'resetzoom'},
          {role: 'zoomin'},
          {role: 'zoomout'},
          {type: 'separator'},
          {role: 'togglefullscreen'}
        ]
      },
      {
        role: 'window',
        submenu: [
          {role: 'minimize'},
          {role: 'close'}
        ]
      },
      {
        role: 'help',
        submenu: [
          {
            label: 'Learn More',
            click () { require('electron').shell.openExternal('https://electronjs.org') }
          }, {
        label: "Join",
        click () { ipcRenderer.send('join'); },
        accelerator: 'CmdOrCtrl+J'
      }, {
        label: "Reboot",
        click () { ipcRenderer.send('reset'); },
        accelerator: 'CmdOrCtrl+F'
      } 
        ]
      }
    ]
  
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}