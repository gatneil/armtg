ARM Template Generator
======================

Motivation
----------

ARM Templates are great, but editing JSON by hand is annoying and error-prone. This ARM Template generator helps with the initial skeleton of the ARM template but leaves the finer details to you. Specifically, this single-page, client-side web site does the following:

    * allow you to add common resources to your template
    * autogenerate dependent resources if desired
    * autopopulate dropdowns with resources you already have in your template
    * add dependency information in the template to avoid race conditions
    * put resource references in the right place (can't remember what virtual machine property is used to reference your network interface? neither can I, but the tool can!)

This site does NOT do the following:

     * allow you to configure the details of each resource


Related Projects
----------------

	* [azurerm](https://github.com/gbowerman/azurerm) is an easy to use python wrapper around the ARM REST API.
	* [Azure Lists](https://negatblog.blob.core.windows.net/lists/meta_list) is a place where I dump lists of things I commonly look up in Azure (OS images, extensions, etc.). These lists refresh periodically, so check the timestamp at the top of the list to make sure the list is recent.


License
-------

MIT License

Copyright (c) 2018 Neil Sant Gat

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.